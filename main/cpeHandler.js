const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const logger = require('./logger_web');
const { buzonDir } = require('../server/storageConfig');

/**
 * CPE Handler con Auto-Recuperación de Errores de Servidor SUNAT (v5.0)
 * Detecta y resuelve automáticamente el popup "Error del Servidor - Señor contribuyente...",
 * refresca la interfaz Angular, reintenta la consulta y extrae XML/CDR con adm-zip.
 */
class CpeHandler {
  constructor() {
    this.downloadPath = path.join(buzonDir, 'cpe_downloads');
    this.activeSessions = new Map(); // ruc -> { browser, context, page }
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
      logger.info('[CPE SCRAPING] Directorio de descargas CPE listo', { path: this.downloadPath });
    }
  }

  async capturarDebug(page, nombre = 'cpe_debug.png') {
    try {
      const debugFile = path.join(this.downloadPath, nombre);
      await page.screenshot({ path: debugFile, fullPage: true });
      logger.info(`[CPE SCRAPING] DEBUG: Captura de pantalla guardada en: ${debugFile}`);
    } catch (e) {
      logger.error(`[CPE SCRAPING] Error al capturar screenshot debug: ${e.message}`);
    }
  }

  /**
   * Cierra anuncios, popups y diálogos informativos
   */
  async manejarIntersticiales(page) {
    try {
      const selectors = [
        'button:has-text("Continuar")',
        '#btnContinuar',
        'input[value="Continuar"]',
        'button:has-text("Aceptar")',
        '#btnAceptar',
        'a:has-text("Omitir")',
        '#btnCerrar',
        '.btn-primary:has-text("Siguiente")'
      ];
      
      for (const selector of selectors) {
        try {
          if (await page.isVisible(selector, { timeout: 800 })) {
            logger.info(`[CPE SCRAPING] Popup cerrado: ${selector}`);
            await page.click(selector);
            await page.waitForTimeout(1000);
          }
        } catch (e) {}
      }

      await page.evaluate(() => {
        const overlays = document.querySelectorAll('.modal-backdrop, .modal, .ui-widget-overlay');
        overlays.forEach(el => el.remove());
        document.body.classList.remove('modal-open');
      }).catch(() => {});

    } catch (e) {}
  }

  /**
   * Detecta si SUNAT mostró el temido popup "Error del Servidor / Señor contribuyente disculpe la molestia..."
   * Si aparece, pulsa Aceptar, recarga el portal Angular y vuelve a sincronizar la vista.
   */
  async detectarYResolverErrorServidor(page) {
    try {
      const isServerError = await page.evaluate(() => {
        const body = document.body ? document.body.innerText : '';
        return body.includes('Error del Servidor') || 
               body.includes('disculpe la molestia') || 
               body.includes('no se puede acceder a los servicios de SUNAT') ||
               body.includes('reintentar en 5 minutos');
      });

      if (isServerError) {
        logger.warn('[CPE SCRAPING] ⚠️ Detectado popup "Error del Servidor" de SUNAT. Cerrando y refrescando portal CPE...');
        
        // 1. Pulsar Aceptar en el popup
        const btnAceptar = await page.$('.modal-footer button, .modal-dialog button, button:has-text("Aceptar"), #btnAceptar');
        if (btnAceptar) {
          await btnAceptar.click().catch(() => {});
          await page.waitForTimeout(1000);
        }

        // 2. Refrescar / Recargar el portal CPE Angular
        const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
        await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(2500);
        await page.waitForSelector('label[for="recibido"], #recibido, input[name="rucEmisor"], input[formcontrolname="rucEmisor"]', { timeout: 35000 }).catch(() => {});
        logger.info('[CPE SCRAPING] ✅ Portal CPE reiniciado y listo tras Error del Servidor.');
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Helper seguro de descarga que jamás genera UnhandledPromiseRejections ni crashea el servidor
   */
  async _descargarArchivoSeguro(page, selectors, targetPath, timeoutMs = 12000) {
    try {
      for (const selector of selectors) {
        const btn = await page.$(selector).catch(() => null);
        if (btn) {
          const isDisabled = await btn.evaluate(b => b.hasAttribute('disabled') || b.classList.contains('disabled')).catch(() => false);
          if (isDisabled) continue;

          let downloadEvent = null;
          try {
            const [download] = await Promise.all([
              page.waitForEvent('download', { timeout: timeoutMs }).catch(() => null),
              btn.click().catch(() => btn.evaluate(b => b.click()).catch(() => {}))
            ]);
            downloadEvent = download;
          } catch (evErr) {}

          if (downloadEvent) {
            await downloadEvent.saveAs(targetPath);
            logger.info(`[CPE SCRAPING] ✅ Archivo descargado exitosamente: ${path.basename(targetPath)}`);
            return targetPath;
          }
        }
      }
    } catch (e) {
      logger.warn(`[CPE SCRAPING] Advertencia en descarga segura: ${e.message}`);
    }
    return null;
  }

  /**
   * Helper para obtener o crear la sesión activa dedicada de Playwright para CPE
   */
  async _obtenerOSesionActiva(ruc, usuario, clave) {
    if (this.activeSessions.has(ruc)) {
      const session = this.activeSessions.get(ruc);
      if (session && session.page && !session.page.isClosed()) {
        try {
          const hasForm = await session.page.$('input[name="rucEmisor"], input[formcontrolname="rucEmisor"], label[for="recibido"]').catch(() => null);
          if (hasForm) {
            logger.info(`[CPE SCRAPING] ✅ Reutilizando sesión activa y confirmada en formulario para RUC ${ruc}`);
            return session;
          }
        } catch (e) {}
        
        try { await session.browser.close(); } catch (err) {}
        this.activeSessions.delete(ruc);
      }
    }

    logger.info(`[CPE SCRAPING] [FASE 0] Creando nueva sesión Chromium (Headless) para RUC ${ruc}...`);
    
    const isHeadless = process.env.PLAYWRIGHT_HEADLESS !== 'false';

    const browser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1366,900'
      ]
    });

    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: {
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      }
    });

    const page = await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-PE', 'es', 'en'] });
    });

    page.setDefaultTimeout(35000);
    page.setDefaultNavigationTimeout(90000);

    // ========== PASO 1: LOGIN EN SUNAT SOL ==========
    const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
    logger.info(`[CPE SCRAPING] [FASE 1: LOGIN] Navegando a ${loginUrl}`);

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('#txtRuc', { timeout: 35000 });
    await page.waitForTimeout(1000);

    logger.info(`[CPE SCRAPING] [FASE 1: LOGIN] Rellenando credenciales SOL para RUC: ${ruc} / Usuario: ${usuario}`);
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.fill('#txtRuc', ruc.trim());
      await page.waitForTimeout(200);
      await page.fill('#txtUsuario', (usuario || '').trim().toUpperCase());
      await page.waitForTimeout(200);
      await page.fill('#txtContrasena', (clave || '').trim());
      await page.waitForTimeout(300);

      const rucVal = await page.inputValue('#txtRuc').catch(() => '');
      const userVal = await page.inputValue('#txtUsuario').catch(() => '');
      if (rucVal === ruc.trim() && userVal === (usuario || '').trim().toUpperCase()) {
        break;
      }
      logger.info(`[CPE SCRAPING] [FASE 1: LOGIN] Reintentando llenado de campos (${attempt}/3)...`);
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}),
      page.click('#btnAceptar')
    ]);

    await page.waitForTimeout(3000);

    // Manejo de diálogo de sesión previa
    try {
      const sessionHandled = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a'));
        const target = btns.find(b => {
          const t = (b.value || b.innerText || '').toLowerCase();
          return t.includes('continuar') || t.includes('cerrar sesi') || t.includes('aceptar');
        });
        if (target) {
          target.click();
          return true;
        }
        return false;
      });
      if (sessionHandled) {
        logger.info('[CPE SCRAPING] [FASE 1: LOGIN] Diálogo de sesión concurrente aceptado.');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    } catch (e) {}

    // Verificar si las credenciales fueron rechazadas por SUNAT
    const authError = await page.evaluate(() => {
      const body = document.body ? document.body.innerText : '';
      if (body.includes('El RUC o usuario o clave no coinciden') || 
          body.includes('Usuario o clave incorrecta') ||
          body.includes('credenciales ingresadas son incorrectas') ||
          body.includes('no se encuentra registrado') ||
          body.includes('Usuario no habilitado')) {
        return 'Credenciales SOL incorrectas en SUNAT. Verifique RUC, Usuario y Clave SOL.';
      }
      return null;
    });

    if (authError) {
      logger.error(`[CPE SCRAPING] ❌ Fallo de autenticación SOL: ${authError}`);
      await this.capturarDebug(page, `cpe_auth_error_${ruc}.png`);
      await browser.close().catch(() => {});
      throw new Error(authError);
    }

    let currentUrl = page.url();
    logger.info(`[CPE SCRAPING] [FASE 1: LOGIN] URL post-login: ${currentUrl}`);

    if (currentUrl.includes('api-seguridad')) {
      logger.info('[CPE SCRAPING] Detectada página OAuth intermedia, volviendo al menú principal...');
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
    }

    await this.manejarIntersticiales(page);
    logger.info('[CPE SCRAPING] [FASE 1: LOGIN] ✅ Login en SUNAT exitoso');

    // ========== PASO 2: NAVEGACIÓN DIRECTA A LA INTERFAZ ==========
    const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
    logger.info(`[CPE SCRAPING] [FASE 2: MENÚ] Navegando a menú de consulta: ${consultaUrl}`);
    await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // ========== PASO 3: NAVEGAR AL PORTAL CPE ANGULAR ==========
    const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
    logger.info(`[CPE SCRAPING] [FASE 3: PORTAL ANGULAR] Navegando a portal CPE: ${cpeUrl}`);
    await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    
    // Esperar a que el formulario Angular renderice
    logger.info('[CPE SCRAPING] [FASE 3: PORTAL ANGULAR] Esperando renderizado de selectores Angular...');
    const selectorFound = await page.waitForSelector('label[for="recibido"], #recibido, input[name="rucEmisor"], input[formcontrolname="rucEmisor"]', { timeout: 35000 }).catch(() => null);
    
    if (selectorFound) {
      logger.info('[CPE SCRAPING] [FASE 3: PORTAL ANGULAR] ✅ Formulario Angular detectado y listo para consultas.');
    } else {
      logger.warn(`[CPE SCRAPING] [FASE 3: PORTAL ANGULAR] ⚠️ Selector no visible a los 35s. URL actual: ${page.url()}`);
      await this.detectarYResolverErrorServidor(page);
    }
    
    await page.waitForTimeout(2000);

    const session = { browser, context, page };
    this.activeSessions.set(ruc, session);
    return session;
  }

  /**
   * Consulta y descarga en lote con recuperación automática ante errores de servidor de SUNAT
   */
  async descargarLoteCPE({ ruc, usuario, clave, facturas }) {
    logger.info(`[CPE SCRAPING] Iniciando procesamiento de ${facturas.length} comprobante(s) para RUC ${ruc}`);
    
    const clientDownloadFolder = path.join(this.downloadPath, ruc);
    if (!fs.existsSync(clientDownloadFolder)) {
      fs.mkdirSync(clientDownloadFolder, { recursive: true });
    }

    let session = null;
    try {
      session = await this._obtenerOSesionActiva(ruc, usuario, clave);
    } catch (errSession) {
      logger.error(`[CPE SCRAPING] Error de sesión en SUNAT: ${errSession.message}`);
      return facturas.map(f => ({
        id: f.id,
        estado: 'ERROR_CREDENCIALES',
        mensaje: errSession.message
      }));
    }

    const { page } = session;
    const resultados = [];

    // ========== PASO 4: PROCESAR CADA COMPROBANTE CON AUTO-REINTENTO ==========
    for (let i = 0; i < facturas.length; i++) {
      const factura = facturas[i];
      const { rucEmisor, tipoDoc = '01', serie, numero, filtro = 'recibido' } = factura;
      logger.info(`[CPE SCRAPING] (${i + 1}/${facturas.length}) Procesando ${rucEmisor} | Tipo: ${tipoDoc} | ${serie}-${numero} | Filtro: ${filtro}`);

      let facturaProcesada = false;
      let resultadoComprobante = null;

      for (let intento = 1; intento <= 3; intento++) {
        try {
          // 1. Detectar y resolver si SUNAT mostró popup de "Error del Servidor"
          await this.detectarYResolverErrorServidor(page);

          // 2. Cerrar modal previo si quedó abierto
          try {
            const closeBtn = await page.$('button.close, button[data-dismiss="modal"], .modal-header button');
            if (closeBtn) {
              await closeBtn.click().catch(() => {});
              await page.waitForTimeout(400);
            }
          } catch (e) {}

          // 3. Verificar si el formulario está activo, si no, refrescar portal
          let formInput = await page.$('input[name="rucEmisor"], input[formcontrolname="rucEmisor"]').catch(() => null);
          if (!formInput) {
            logger.info(`[CPE SCRAPING] Formulario no visible en intento ${intento}. Refrescando portal CPE...`);
            const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
            await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
            await page.waitForTimeout(2000);
            await page.waitForSelector('label[for="recibido"], #recibido, input[name="rucEmisor"], input[formcontrolname="rucEmisor"]', { timeout: 30000 }).catch(() => {});
          }

          // 4. Seleccionar "Recibido" o "Emitido"
          if (filtro === 'recibido') {
            try {
              await page.click('label[for="recibido"]', { timeout: 8000 });
            } catch (e) {
              await page.click('#recibido', { timeout: 8000 }).catch(() => {});
            }
          } else {
            try {
              await page.click('label[for="emitido"]', { timeout: 8000 });
            } catch (e) {
              await page.click('#emitido', { timeout: 8000 }).catch(() => {});
            }
          }

          // 5. Rellenar RUC Emisor
          try {
            await page.fill('input[name="rucEmisor"]', rucEmisor, { timeout: 10000 });
          } catch (e) {
            await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor, { timeout: 10000 });
          }

          // 6. Tipo Comprobante
          try {
            const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito', 'R1': 'Recibo por Honorarios' };
            const tipoLabel = tipoLabels[tipoDoc] || 'Factura';

            await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]', { timeout: 8000 });
            await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 5000 }).catch(() => page.click(`text=${tipoLabel}`));
          } catch (e) {}

          // 7. Serie y Número
          try {
            await page.fill('input[name="serieComprobante"]', serie, { timeout: 8000 });
          } catch (e) {
            await page.fill('input[formcontrolname="serieComprobante"]', serie, { timeout: 8000 });
          }

          try {
            await page.fill('input[name="numeroComprobante"]', String(numero), { timeout: 8000 });
          } catch (e) {
            await page.fill('input[formcontrolname="numeroComprobante"]', String(numero), { timeout: 8000 });
          }

          // 8. Click en "Consultar"
          logger.info(`[CPE SCRAPING] Haciendo click en Consultar comprobante ${serie}-${numero} (intento ${intento}/3)...`);
          try {
            await page.click('button.boton-primary:has-text("Consultar")', { timeout: 10000 });
          } catch (e) {
            await page.click('button[type="submit"]:has-text("Consultar")', { timeout: 10000 });
          }

          // Esperar respuesta de SUNAT
          await page.waitForTimeout(4000);

          // Verificar si SUNAT lanzó error del servidor tras el click
          const serverErrorFound = await this.detectarYResolverErrorServidor(page);
          if (serverErrorFound) {
            logger.warn(`[CPE SCRAPING] Error del servidor post-consulta. Reintentando comprobante ${serie}-${numero}...`);
            continue;
          }

          // ========== PASO 5: EXTRAER RESULTADO ==========
          const resultado = await page.evaluate(() => {
            const body = document.body ? document.body.innerText : '';
            const modal = document.querySelector('div[role="document"].modal-dialog');

            if (!modal) {
              if (body.includes('No se encontr') || body.includes('sin resultados') || body.includes('no existe') || body.includes('no existe registro')) {
                return { estado: 'NO_EXISTE', encontrado: false, razonSocial: '', importeTotal: '', modalHtml: '' };
              }
              if (body.includes('ACEPTADO')) return { estado: 'ACEPTADO', encontrado: true, razonSocial: '', importeTotal: '', modalHtml: '' };
              return { estado: 'PENDIENTE_REINTENTO', encontrado: false, razonSocial: '', importeTotal: '', modalHtml: '' };
            }

            const datos = {
              estado: 'ACEPTADO',
              encontrado: true,
              razonSocial: '',
              rucEmisor: '',
              fechaEmision: '',
              importeTotal: '',
              modalHtml: modal.innerHTML
            };

            // 1. Razón Social
            const emisorTable = modal.querySelector('table.emisor');
            if (emisorTable) {
              const bTags = emisorTable.querySelectorAll('b');
              if (bTags.length > 0) datos.razonSocial = bTags[0].innerText.trim();
            }

            // 2. RUC Emisor
            const numeracionTable = modal.querySelector('table.comprobante-numeracion');
            if (numeracionTable) {
              const tds = numeracionTable.querySelectorAll('td');
              tds.forEach(td => {
                const text = td.innerText;
                if (text.includes('RUC:')) datos.rucEmisor = text.replace('RUC:', '').trim();
              });
            }

            // 3. Fecha de Emisión
            const filasDatos = modal.querySelectorAll('tr.comprobante-datosprincipales');
            filasDatos.forEach(tr => {
              const tds = tr.querySelectorAll('td');
              if (tds.length >= 3 && tds[0].innerText.includes('Fecha de Emisión')) {
                datos.fechaEmision = tds[2].innerText.trim();
              }
            });

            // 4. Importe Total
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

          logger.info(`[CPE SCRAPING] Resultado para ${serie}-${numero}: ${resultado.estado} (${resultado.razonSocial || 'Sin Razón Social'})`);

          // ========== CAPTURA DE PANTALLA DEL COMPROBANTE ==========
          let capturaPath = null;
          let capturaBase64 = null;
          const capturaFileName = `CAPTURA-${rucEmisor}-${tipoDoc}-${serie}-${numero}.png`;

          try {
            capturaPath = path.join(clientDownloadFolder, capturaFileName);
            const modalElem = await page.$('div[role="document"].modal-dialog');
            if (modalElem) {
              await modalElem.screenshot({ path: capturaPath });
            } else {
              await page.screenshot({ path: capturaPath, fullPage: false });
            }

            if (fs.existsSync(capturaPath)) {
              capturaBase64 = fs.readFileSync(capturaPath).toString('base64');
              logger.info(`[CPE SCRAPING] 📸 Captura generada para frontend: ${capturaFileName}`);
            }
          } catch (scErr) {}

          // ========== DESCARGA Y EXTRACCIÓN DE XML Y CDR (DEL ZIP / XML DE SUNAT) ==========
          let xmlPath = null;
          let xmlBase64 = null;
          let xmlContent = null;
          let xmlFileName = `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`;
          let cdrPath = null;
          let cdrBase64 = null;
          let cdrContent = null;
          let cdrFileName = `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`;

          if (resultado.encontrado) {
            // 1. Descargar Factura XML oficial
            try {
              const xmlDownloadDest = path.join(clientDownloadFolder, `TEMP_XML_${rucEmisor}_${serie}_${numero}.bin`);
              const downloadedXmlFile = await this._descargarArchivoSeguro(page, [
                'button[ngbtooltip="Descargar XML"]',
                'button:has(i.fa-file-code)',
                'button:has-text("Descargar XML")',
                'button:has-text("XML")'
              ], xmlDownloadDest, 10000);

              if (downloadedXmlFile && fs.existsSync(downloadedXmlFile)) {
                try {
                  const zip = new AdmZip(downloadedXmlFile);
                  const zipEntries = zip.getEntries();

                  for (const entry of zipEntries) {
                    const entryName = entry.entryName.toLowerCase();
                    if (entryName.endsWith('.xml')) {
                      const contentStr = entry.getData().toString('utf8');
                      const isCdr = entryName.startsWith('r-') || entryName.includes('cdr') || contentStr.includes('ApplicationResponse');

                      if (isCdr) {
                        cdrContent = contentStr;
                        cdrBase64 = Buffer.from(contentStr).toString('base64');
                        cdrPath = path.join(clientDownloadFolder, `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                        fs.writeFileSync(cdrPath, contentStr);
                        logger.info(`[CPE SCRAPING] 📦 CDR XML extraído: ${path.basename(cdrPath)}`);
                      } else {
                        xmlContent = contentStr;
                        xmlBase64 = Buffer.from(contentStr).toString('base64');
                        xmlPath = path.join(clientDownloadFolder, `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                        fs.writeFileSync(xmlPath, contentStr);
                        logger.info(`[CPE SCRAPING] 📄 Factura XML extraída: ${path.basename(xmlPath)}`);
                      }
                    }
                  }
                  try { fs.unlinkSync(downloadedXmlFile); } catch (e) {}
                } catch (notZipErr) {
                  const contentStr = fs.readFileSync(downloadedXmlFile, 'utf8');
                  if (contentStr.includes('ApplicationResponse')) {
                    cdrContent = contentStr;
                    cdrBase64 = Buffer.from(contentStr).toString('base64');
                    cdrPath = path.join(clientDownloadFolder, `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                    fs.renameSync(downloadedXmlFile, cdrPath);
                  } else {
                    xmlContent = contentStr;
                    xmlBase64 = Buffer.from(contentStr).toString('base64');
                    xmlPath = path.join(clientDownloadFolder, `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                    fs.renameSync(downloadedXmlFile, xmlPath);
                    logger.info(`[CPE SCRAPING] 📄 Factura XML directa guardada: ${path.basename(xmlPath)}`);
                  }
                }
              }
            } catch (xmlErr) {
              logger.warn(`[CPE SCRAPING] Advertencia al descargar XML: ${xmlErr.message}`);
            }

            // 2. Descargar Constancia CDR oficial
            try {
              const cdrDownloadDest = path.join(clientDownloadFolder, `TEMP_CDR_${rucEmisor}_${serie}_${numero}.bin`);
              const downloadedCdrFile = await this._descargarArchivoSeguro(page, [
                'button[ngbtooltip="Descargar CDR"]',
                'button:has(i.fa-file-contract)',
                'button:has(i.fa-file-signature)',
                'button:has-text("Descargar CDR")',
                'button:has-text("CDR")'
              ], cdrDownloadDest, 10000);

              if (downloadedCdrFile && fs.existsSync(downloadedCdrFile)) {
                try {
                  const zip = new AdmZip(downloadedCdrFile);
                  const zipEntries = zip.getEntries();

                  for (const entry of zipEntries) {
                    const entryName = entry.entryName.toLowerCase();
                    if (entryName.endsWith('.xml')) {
                      const contentStr = entry.getData().toString('utf8');
                      const isCdr = entryName.startsWith('r-') || entryName.includes('cdr') || contentStr.includes('ApplicationResponse');

                      if (isCdr) {
                        cdrContent = contentStr;
                        cdrBase64 = Buffer.from(contentStr).toString('base64');
                        cdrPath = path.join(clientDownloadFolder, `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                        fs.writeFileSync(cdrPath, contentStr);
                        logger.info(`[CPE SCRAPING] 📦 CDR XML extraído: ${path.basename(cdrPath)}`);
                      } else if (!xmlContent) {
                        xmlContent = contentStr;
                        xmlBase64 = Buffer.from(contentStr).toString('base64');
                        xmlPath = path.join(clientDownloadFolder, `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                        fs.writeFileSync(xmlPath, contentStr);
                        logger.info(`[CPE SCRAPING] 📄 Factura XML extraída: ${path.basename(xmlPath)}`);
                      }
                    }
                  }
                  try { fs.unlinkSync(downloadedCdrFile); } catch (e) {}
                } catch (notZipErr) {
                  const contentStr = fs.readFileSync(downloadedCdrFile, 'utf8');
                  if (contentStr.includes('ApplicationResponse')) {
                    cdrContent = contentStr;
                    cdrBase64 = Buffer.from(contentStr).toString('base64');
                    cdrPath = path.join(clientDownloadFolder, `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                    fs.renameSync(downloadedCdrFile, cdrPath);
                  } else if (!xmlContent) {
                    xmlContent = contentStr;
                    xmlBase64 = Buffer.from(contentStr).toString('base64');
                    xmlPath = path.join(clientDownloadFolder, `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                    fs.renameSync(downloadedCdrFile, xmlPath);
                  }
                }
              }
            } catch (cdrErr) {
              logger.warn(`[CPE SCRAPING] Advertencia al descargar CDR: ${cdrErr.message}`);
            }
          }

          resultadoComprobante = {
            id: factura.id,
            rucEmisor,
            tipoDoc,
            serie,
            numero,
            estado: resultado.estado,
            mensaje: resultado.razonSocial ? `${resultado.razonSocial} (S/ ${resultado.importeTotal})` : resultado.estado,
            razonSocial: resultado.razonSocial,
            fechaEmision: resultado.fechaEmision,
            importeTotal: resultado.importeTotal,
            modalHtml: resultado.modalHtml,
            xmlPath,
            xmlBase64,
            xmlContent,
            xmlFileName,
            cdrPath,
            cdrBase64,
            cdrContent,
            cdrFileName,
            capturaPath,
            capturaBase64,
            capturaFileName
          };

          facturaProcesada = true;
          break; // Éxito, salir del bucle de reintento

        } catch (itemErr) {
          logger.warn(`[CPE SCRAPING] Intento ${intento}/3 falló para comprobante ${serie}-${numero}: ${itemErr.message}`);
          await this.detectarYResolverErrorServidor(page);
          await page.waitForTimeout(2000);
        }
      }

      if (facturaProcesada && resultadoComprobante) {
        resultados.push(resultadoComprobante);
      } else {
        await this.capturarDebug(page, `cpe_failed_${serie}_${numero}.png`);
        resultados.push({
          id: factura.id,
          rucEmisor,
          tipoDoc,
          serie,
          numero,
          estado: 'PENDIENTE_REINTENTO',
          mensaje: 'SUNAT reportó error temporal en el servidor. Comprobante listo para reintentar.'
        });
      }
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
