const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger_web');
const { buzonDir } = require('../server/storageConfig');

/**
 * CPE Handler 100% Fiel a consultas/cpeScrapingHandler.js
 * Optimizado para entornos Cloud (Railway/Linux) con headless: true,
 * manejo de intersticiales y trazabilidad detallada paso a paso.
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

  async manejarIntersticiales(page) {
    try {
      logger.info('[CPE SCRAPING] Verificando anuncios o popups de SUNAT...');
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
          if (await page.isVisible(selector, { timeout: 1000 })) {
            logger.info(`[CPE SCRAPING] Popup detectado y cerrado: ${selector}`);
            await page.click(selector);
            await page.waitForTimeout(1500);
          }
        } catch (e) {}
      }

      // Remover overlays o backdrops bloqueantes
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('.modal-backdrop, .modal, .ui-widget-overlay');
        overlays.forEach(el => el.remove());
        document.body.classList.remove('modal-open');
      }).catch(() => {});

    } catch (e) {
      logger.error(`[CPE SCRAPING] Error en manejarIntersticiales: ${e.message}`);
    }
  }

  /**
   * Helper para obtener o crear la sesión activa dedicada de Playwright para CPE
   */
  async _obtenerOSesionActiva(ruc, usuario, clave) {
    // 1. Reutilizar sesión activa si el formulario ya está visible en el navegador
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
    
    // En Railway/Linux Cloud, headless DEBE ser true para evitar errores de XServer/Display
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

    // Anti-detección estándar de consultas
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
    
    // Rellenado robusto con verificación
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

    // Manejo de diálogo de sesión previa o concurrente ("Continuar", "Cerrar sesión")
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
      await this.capturarDebug(page, `cpe_angular_not_rendered_${ruc}.png`);
    }
    
    await page.waitForTimeout(2000);

    const session = { browser, context, page };
    this.activeSessions.set(ruc, session);
    return session;
  }

  /**
   * Consulta y descarga en lote (Fiel a cpeScrapingHandler.js)
   */
  async descargarLoteCPE({ ruc, usuario, clave, facturas }) {
    logger.info(`[CPE SCRAPING] Iniciando procesamiento de ${facturas.length} comprobante(s) (máx 30s c/u) para RUC ${ruc}`);
    
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

    // ========== PASO 4: PROCESAR CADA COMPROBANTE ==========
    for (let i = 0; i < facturas.length; i++) {
      const factura = facturas[i];
      const { rucEmisor, tipoDoc = '01', serie, numero, filtro = 'recibido' } = factura;
      logger.info(`[CPE SCRAPING] (${i + 1}/${facturas.length}) Procesando ${rucEmisor} | Tipo: ${tipoDoc} | ${serie}-${numero} | Filtro: ${filtro}`);

      try {
        // Cerrar modal previo si quedó abierto
        try {
          const closeBtn = await page.$('button.close, button[data-dismiss="modal"], .modal-header button');
          if (closeBtn) {
            await closeBtn.click().catch(() => {});
            await page.waitForTimeout(500);
          }
        } catch (e) {}

        // Seleccionar "Recibido" o "Emitido" (timeout 12s)
        if (filtro === 'recibido') {
          try {
            await page.click('label[for="recibido"]', { timeout: 12000 });
          } catch (e) {
            await page.click('#recibido', { timeout: 12000 }).catch(() => {});
          }
        } else {
          try {
            await page.click('label[for="emitido"]', { timeout: 12000 });
          } catch (e) {
            await page.click('#emitido', { timeout: 12000 }).catch(() => {});
          }
        }

        // Rellenar RUC Emisor (timeout 15s)
        try {
          await page.fill('input[name="rucEmisor"]', rucEmisor, { timeout: 15000 });
        } catch (e) {
          await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor, { timeout: 15000 });
        }

        // Tipo Comprobante (p-dropdown) (timeout 12s)
        try {
          const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito', 'R1': 'Recibo por Honorarios' };
          const tipoLabel = tipoLabels[tipoDoc] || 'Factura';

          await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]', { timeout: 12000 });
          await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 6000 }).catch(() => page.click(`text=${tipoLabel}`));
        } catch (e) {
          logger.warn(`[CPE SCRAPING] Advertencia al seleccionar tipo comprobante: ${e.message}`);
        }

        // Serie (timeout 12s)
        try {
          await page.fill('input[name="serieComprobante"]', serie, { timeout: 12000 });
        } catch (e) {
          await page.fill('input[formcontrolname="serieComprobante"]', serie, { timeout: 12000 });
        }

        // Número (timeout 12s)
        try {
          await page.fill('input[name="numeroComprobante"]', String(numero), { timeout: 12000 });
        } catch (e) {
          await page.fill('input[formcontrolname="numeroComprobante"]', String(numero), { timeout: 12000 });
        }

        // Click en "Consultar" (timeout 12s)
        logger.info(`[CPE SCRAPING] Haciendo click en Consultar comprobante ${serie}-${numero}...`);
        try {
          await page.click('button.boton-primary:has-text("Consultar")', { timeout: 12000 });
        } catch (e) {
          await page.click('button[type="submit"]:has-text("Consultar")', { timeout: 12000 });
        }

        // Esperar respuesta de SUNAT (4 segundos)
        await page.waitForTimeout(4000);

        // ========== PASO 5: EXTRAER RESULTADO ==========
        const resultado = await page.evaluate(() => {
          const body = document.body ? document.body.innerText : '';
          const modal = document.querySelector('div[role="document"].modal-dialog');

          if (!modal) {
            if (body.includes('No se encontr') || body.includes('sin resultados') || body.includes('no existe') || body.includes('no existe registro')) {
              return { estado: 'NO_EXISTE', encontrado: false, razonSocial: '', importeTotal: '' };
            }
            if (body.includes('ACEPTADO')) return { estado: 'ACEPTADO', encontrado: true, razonSocial: '', importeTotal: '' };
            return { estado: 'PENDIENTE_REINTENTO', encontrado: false, razonSocial: '', importeTotal: '' };
          }

          const datos = {
            estado: 'ACEPTADO',
            encontrado: true,
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

          if (body.includes('Estado del comprobante: ACEPTADO') || body.includes('ACTIVO')) {
            datos.estado = 'ACEPTADO';
          } else if (body.includes('ANULADO') || body.includes('BAJA')) {
            datos.estado = 'ANULADO';
          }

          return datos;
        });

        logger.info(`[CPE SCRAPING] Resultado para ${serie}-${numero}: ${resultado.estado} (${resultado.razonSocial || 'Sin Razón Social'})`);

        // ========== DESCARGA NATIVA DE XML Y CDR ==========
        let xmlPath = null;
        let cdrPath = null;
        let pdfPath = null;

        if (resultado.encontrado) {
          // Descargar XML
          try {
            const btnXml = await page.$('button[ngbtooltip="Descargar XML"]') || await page.$('button i.fa-file-code');
            if (btnXml) {
              const downloadPromise = page.waitForEvent('download', { timeout: 12000 });
              await btnXml.click();
              const download = await downloadPromise;
              const fn = `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`;
              const dest = path.join(clientDownloadFolder, fn);
              await download.saveAs(dest);
              xmlPath = dest;
              logger.info(`[CPE SCRAPING] XML descargado con éxito: ${fn}`);
            }
          } catch (e) {
            logger.warn(`[CPE SCRAPING] No se pudo descargar XML de ${serie}-${numero}: ${e.message}`);
          }

          // Descargar CDR
          try {
            const btnCdr = await page.evaluateHandle(() => {
              const tilde = document.querySelector('button[ngbtooltip="Descargar CDR"]');
              if (tilde) return tilde;
              const icons = Array.from(document.querySelectorAll('i'));
              const icon = icons.find(i => i.classList.contains('fa-file-contract') || i.classList.contains('fa-file-signature'));
              return icon ? icon.closest('button') : null;
            });
            if (btnCdr) {
              const downloadPromise = page.waitForEvent('download', { timeout: 12000 });
              await btnCdr.click();
              const download = await downloadPromise;
              const fn = `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.zip`;
              const dest = path.join(clientDownloadFolder, fn);
              await download.saveAs(dest);
              cdrPath = dest;
              logger.info(`[CPE SCRAPING] CDR descargado con éxito: ${fn}`);
            }
          } catch (e) {
            logger.warn(`[CPE SCRAPING] No se pudo descargar CDR de ${serie}-${numero}: ${e.message}`);
          }
        }

        resultados.push({
          id: factura.id,
          estado: resultado.estado,
          mensaje: resultado.razonSocial ? `${resultado.razonSocial} (S/ ${resultado.importeTotal})` : resultado.estado,
          xmlPath,
          cdrPath,
          pdfPath
        });

      } catch (itemErr) {
        logger.warn(`[CPE SCRAPING] ⏱️ Timeout/Fallo en factura ${serie}-${numero} (<30s). Pasando a la siguiente: ${itemErr.message}`);
        await this.capturarDebug(page, `cpe_item_error_${serie}_${numero}.png`);
        resultados.push({
          id: factura.id,
          estado: 'PENDIENTE_REINTENTO',
          mensaje: 'SUNAT no respondió en 30s. Comprobante guardado como pendiente para reintentar.'
        });
      }
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
