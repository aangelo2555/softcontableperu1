const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const logger = require('./logger_web');
const { buzonDir } = require('../server/storageConfig');

/**
 * CPE Handler de Alta Velocidad (v4.0)
 * Extrae directamente el paquete XML/ZIP de SUNAT, lo descomprime en memoria con adm-zip
 * y envía el XML y CDR al frontend en segundos para renderizado vectorial propio.
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
      logger.info(`[CPE SCRAPING] DEBUG: Captura guardada en: ${debugFile}`);
    } catch (e) {
      logger.error(`[CPE SCRAPING] Error al capturar screenshot debug: ${e.message}`);
    }
  }

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

      // Remover overlays o backdrops bloqueantes
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('.modal-backdrop, .modal, .ui-widget-overlay');
        overlays.forEach(el => el.remove());
        document.body.classList.remove('modal-open');
      }).catch(() => {});

    } catch (e) {}
  }

  /**
   * Helper seguro de descarga: espera el evento de descarga nativo sin lanzar excepciones no controladas
   */
  async _descargarArchivoSeguro(page, selectors, targetPath, timeoutMs = 8000) {
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
            logger.info(`[CPE SCRAPING] ✅ Descarga completada: ${path.basename(targetPath)}`);
            return targetPath;
          }
        }
      }
    } catch (e) {
      logger.warn(`[CPE SCRAPING] Advertencia en descarga: ${e.message}`);
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
            logger.info(`[CPE SCRAPING] ✅ Reutilizando sesión activa para RUC ${ruc}`);
            return session;
          }
        } catch (e) {}
        
        try { await session.browser.close(); } catch (err) {}
        this.activeSessions.delete(ruc);
      }
    }

    logger.info(`[CPE SCRAPING] [FASE 0] Iniciando Chromium Headless para RUC ${ruc}...`);
    
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
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
      }
    });

    const page = await context.newPage();

    // Anti-detección
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-PE', 'es', 'en'] });
    });

    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);

    // ========== PASO 1: LOGIN EN SUNAT SOL ==========
    const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
    logger.info(`[CPE SCRAPING] [FASE 1: LOGIN] Conectando a SUNAT SOL...`);

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#txtRuc', { timeout: 30000 });

    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.fill('#txtRuc', ruc.trim());
      await page.fill('#txtUsuario', (usuario || '').trim().toUpperCase());
      await page.fill('#txtContrasena', (clave || '').trim());
      await page.waitForTimeout(200);

      const rucVal = await page.inputValue('#txtRuc').catch(() => '');
      const userVal = await page.inputValue('#txtUsuario').catch(() => '');
      if (rucVal === ruc.trim() && userVal === (usuario || '').trim().toUpperCase()) {
        break;
      }
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
      page.click('#btnAceptar')
    ]);

    await page.waitForTimeout(2500);

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
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      }
    } catch (e) {}

    // Verificar credenciales
    const authError = await page.evaluate(() => {
      const body = document.body ? document.body.innerText : '';
      if (body.includes('El RUC o usuario o clave no coinciden') || 
          body.includes('Usuario o clave incorrecta') ||
          body.includes('credenciales ingresadas son incorrectas') ||
          body.includes('no se encuentra registrado') ||
          body.includes('Usuario no habilitado')) {
        return 'Credenciales SOL incorrectas en SUNAT.';
      }
      return null;
    });

    if (authError) {
      await browser.close().catch(() => {});
      throw new Error(authError);
    }

    let currentUrl = page.url();
    if (currentUrl.includes('api-seguridad')) {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(2000);
    }

    await this.manejarIntersticiales(page);

    // ========== PASO 2: NAVEGACIÓN DIRECTA AL MENÚ ==========
    const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
    await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // ========== PASO 3: NAVEGAR AL PORTAL CPE ANGULAR ==========
    const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
    await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    
    await page.waitForSelector('label[for="recibido"], #recibido, input[name="rucEmisor"], input[formcontrolname="rucEmisor"]', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const session = { browser, context, page };
    this.activeSessions.set(ruc, session);
    return session;
  }

  /**
   * Consulta y extracción ultra-rápida de XML/CDR
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

    // ========== PASO 4: PROCESAR COMPROBANTES ==========
    for (let i = 0; i < facturas.length; i++) {
      const factura = facturas[i];
      const { rucEmisor, tipoDoc = '01', serie, numero, filtro = 'recibido' } = factura;
      logger.info(`[CPE SCRAPING] (${i + 1}/${facturas.length}) Procesando ${rucEmisor} | Tipo: ${tipoDoc} | ${serie}-${numero}`);

      try {
        // Cerrar modal previo si quedó abierto
        try {
          const closeBtn = await page.$('button.close, button[data-dismiss="modal"], .modal-header button');
          if (closeBtn) {
            await closeBtn.click().catch(() => {});
            await page.waitForTimeout(300);
          }
        } catch (e) {}

        // 1. Filtro Recibido / Emitido
        if (filtro === 'recibido') {
          await page.click('label[for="recibido"]').catch(() => page.click('#recibido').catch(() => {}));
        } else {
          await page.click('label[for="emitido"]').catch(() => page.click('#emitido').catch(() => {}));
        }

        // 2. RUC Emisor
        try {
          await page.fill('input[name="rucEmisor"]', rucEmisor);
        } catch (e) {
          await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor);
        }

        // 3. Tipo Comprobante
        try {
          const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito', 'R1': 'Recibo por Honorarios' };
          const tipoLabel = tipoLabels[tipoDoc] || 'Factura';
          await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]', { timeout: 5000 });
          await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 3000 }).catch(() => page.click(`text=${tipoLabel}`));
        } catch (e) {}

        // 4. Serie y Número
        try {
          await page.fill('input[name="serieComprobante"]', serie);
        } catch (e) {
          await page.fill('input[formcontrolname="serieComprobante"]', serie);
        }

        try {
          await page.fill('input[name="numeroComprobante"]', String(numero));
        } catch (e) {
          await page.fill('input[formcontrolname="numeroComprobante"]', String(numero));
        }

        // 5. Clic en "Consultar"
        logger.info(`[CPE SCRAPING] Consultando ${serie}-${numero}...`);
        await page.click('button.boton-primary:has-text("Consultar")').catch(() => page.click('button[type="submit"]:has-text("Consultar")'));

        // Esperar modal de respuesta de SUNAT (2.5s)
        await page.waitForTimeout(2500);

        // ========== PASO 5: EXTRAER DATOS DEL RESULTADO ==========
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

        logger.info(`[CPE SCRAPING] Estado SUNAT para ${serie}-${numero}: ${resultado.estado} (${resultado.razonSocial || 'Comprobante Electrónico'})`);

        // ========== PASO 6: EXTRACCIÓN ULTRA RÁPIDA DE XML Y CDR (UN SOLO PASO CON ADM-ZIP) ==========
        let xmlPath = null;
        let xmlBase64 = null;
        let xmlContent = null;
        let xmlFileName = `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`;
        let cdrPath = null;
        let cdrBase64 = null;
        let cdrContent = null;
        let cdrFileName = `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`;
        let capturaBase64 = null;

        // Captura rápida de respaldo
        try {
          const modalElem = await page.$('div[role="document"].modal-dialog');
          if (modalElem) {
            const scBuffer = await modalElem.screenshot();
            capturaBase64 = scBuffer.toString('base64');
          }
        } catch (e) {}

        if (resultado.encontrado) {
          try {
            const tempDownloadPath = path.join(clientDownloadFolder, `SUNAT_${rucEmisor}_${serie}_${numero}_download.bin`);
            const downloadedFile = await this._descargarArchivoSeguro(page, [
              'button[ngbtooltip="Descargar XML"]',
              'button:has(i.fa-file-code)',
              'button[ngbtooltip="Descargar CDR"]',
              'button:has(i.fa-file-contract)',
              'button:has(i.fa-file-signature)',
              'button:has-text("Descargar XML")',
              'button:has-text("XML")',
              'button:has-text("CDR")'
            ], tempDownloadPath, 7000);

            if (downloadedFile && fs.existsSync(downloadedFile)) {
              try {
                // Descomprimir paquete ZIP de SUNAT en memoria
                const zip = new AdmZip(downloadedFile);
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
                      logger.info(`[CPE SCRAPING] 📦 CDR extraído del paquete: ${path.basename(cdrPath)}`);
                    } else {
                      xmlContent = contentStr;
                      xmlBase64 = Buffer.from(contentStr).toString('base64');
                      xmlPath = path.join(clientDownloadFolder, `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                      fs.writeFileSync(xmlPath, contentStr);
                      logger.info(`[CPE SCRAPING] 📄 XML extraído del paquete: ${path.basename(xmlPath)}`);
                    }
                  }
                }
                try { fs.unlinkSync(downloadedFile); } catch (e) {}
              } catch (notZipErr) {
                // Si el archivo no era ZIP sino XML directo
                const contentStr = fs.readFileSync(downloadedFile, 'utf8');
                if (contentStr.includes('ApplicationResponse')) {
                  cdrContent = contentStr;
                  cdrBase64 = Buffer.from(contentStr).toString('base64');
                  cdrPath = path.join(clientDownloadFolder, `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                  fs.renameSync(downloadedFile, cdrPath);
                } else {
                  xmlContent = contentStr;
                  xmlBase64 = Buffer.from(contentStr).toString('base64');
                  xmlPath = path.join(clientDownloadFolder, `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`);
                  fs.renameSync(downloadedFile, xmlPath);
                }
              }
            }
          } catch (dlErr) {
            logger.warn(`[CPE SCRAPING] Advertencia al extraer XML: ${dlErr.message}`);
          }
        }

        resultados.push({
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
          capturaBase64
        });

      } catch (itemErr) {
        logger.warn(`[CPE SCRAPING] Fallo en comprobante ${serie}-${numero}: ${itemErr.message}`);
        await this.capturarDebug(page, `cpe_error_${serie}_${numero}.png`);
        resultados.push({
          id: factura.id,
          rucEmisor,
          tipoDoc,
          serie,
          numero,
          estado: 'PENDIENTE_REINTENTO',
          mensaje: 'No se pudo consultar el comprobante en SUNAT.'
        });
      }
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
