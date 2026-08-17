const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger_web');
const { buzonDir } = require('../server/storageConfig');

/**
 * CPE Handler 100% Fiel a consultas/cpeScrapingHandler.js
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
      logger.info('Directorio de descargas CPE listo', { path: this.downloadPath });
    }
  }

  /**
   * Helper para obtener o crear la sesión activa dedicada de Playwright para CPE
   */
  async _obtenerOSesionActiva(ruc, usuario, clave) {
    // 1. Reutilizar sesión activa solo si el formulario está verdaderamente cargado
    if (this.activeSessions.has(ruc)) {
      const session = this.activeSessions.get(ruc);
      if (session && session.page && !session.page.isClosed()) {
        try {
          const hasForm = await session.page.$('input[name="rucEmisor"], input[formcontrolname="rucEmisor"]').catch(() => null);
          if (hasForm) {
            logger.info(`[CPE SCRAPING] Reutilizando sesión activa y confirmada en formulario para RUC ${ruc}`);
            return session;
          }
        } catch (e) {}
        
        try { await session.browser.close(); } catch (err) {}
        this.activeSessions.delete(ruc);
      }
    }

    logger.info(`[CPE SCRAPING] Creando nueva sesión dedicada de Chromium para RUC ${ruc}...`);
    
    const browser = await chromium.launch({
      headless: true,
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

    const page = await context.newPage();

    // Anti-detección estándar de consultas
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);

    // ========== PASO 1: LOGIN EN SUNAT SOL ==========
    const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
    logger.info(`[CPE SCRAPING] PASO 1: Navegando al login SUNAT ${loginUrl}`);

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#txtRuc', { timeout: 30000 });

    logger.info(`[CPE SCRAPING] Rellenando credenciales SOL: ${ruc} - ${usuario}`);
    await page.fill('#txtRuc', ruc.trim());
    await page.waitForTimeout(300);
    await page.fill('#txtUsuario', (usuario || '').trim().toUpperCase());
    await page.waitForTimeout(300);
    await page.fill('#txtContrasena', (clave || '').trim());
    await page.waitForTimeout(300);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
      page.click('#btnAceptar')
    ]);

    await page.waitForTimeout(3000);

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
      logger.error(`[CPE SCRAPING] Fallo de autenticación: ${authError}`);
      await browser.close().catch(() => {});
      throw new Error(authError);
    }

    let currentUrl = page.url();
    if (currentUrl.includes('api-seguridad')) {
      logger.info('[CPE SCRAPING] Detectada página OAuth, navegando al menú principal...');
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
    }

    logger.info('[CPE SCRAPING] Login exitoso, continuando...');

    // ========== PASO 2: NAVEGACIÓN DIRECTA A LA INTERFAZ ==========
    const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
    logger.info(`[CPE SCRAPING] PASO 2: Navegando directamente a la interfaz de consulta...`);
    await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // ========== PASO 3: NAVEGAR AL PORTAL CPE ==========
    const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
    logger.info(`[CPE SCRAPING] PASO 3: Navegando al portal CPE: ${cpeUrl}`);
    await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    logger.info('[CPE SCRAPING] Esperando inicialización del formulario Angular...');
    await page.waitForSelector('input[name="rucEmisor"], input[formcontrolname="rucEmisor"], #rucEmisor', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const session = { browser, context, page };
    this.activeSessions.set(ruc, session);
    return session;
  }

  /**
   * Consulta y descarga en lote (Fiel a cpeScrapingHandler.js con timeout de 20s)
   */
  async descargarLoteCPE({ ruc, usuario, clave, facturas }) {
    logger.info(`[CPE SCRAPING] Iniciando procesamiento de ${facturas.length} comprobante(s) (máx 20s c/u) para RUC ${ruc}`);
    
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

    // ========== PASO 4: PROCESAR CADA COMPROBANTE (Timeout de 20s por comprobante) ==========
    for (let i = 0; i < facturas.length; i++) {
      const factura = facturas[i];
      const { rucEmisor, tipoDoc = '01', serie, numero, filtro = 'recibido' } = factura;
      logger.info(`[CPE SCRAPING] (${i + 1}/${facturas.length}) Procesando ${rucEmisor} - ${tipoDoc} - ${serie}-${numero}`);

      try {
        // Cerrar modal previo si quedó abierto
        try {
          const closeBtn = await page.$('button.close, button[data-dismiss="modal"], .modal-header button');
          if (closeBtn) await closeBtn.click().catch(() => {});
        } catch (e) {}

        // Seleccionar "Recibido" o "Emitido"
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

        // Rellenar RUC Emisor
        try {
          await page.fill('input[name="rucEmisor"]', rucEmisor, { timeout: 10000 });
        } catch (e) {
          await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor, { timeout: 10000 });
        }

        // Tipo Comprobante (p-dropdown)
        try {
          const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito', 'R1': 'Recibo por Honorarios' };
          const tipoLabel = tipoLabels[tipoDoc] || 'Factura';

          await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]', { timeout: 8000 });
          await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 4000 }).catch(() => page.click(`text=${tipoLabel}`));
        } catch (e) {
          logger.warn(`[CPE SCRAPING] Advertencia al seleccionar tipo comprobante: ${e.message}`);
        }

        // Serie
        try {
          await page.fill('input[name="serieComprobante"]', serie, { timeout: 8000 });
        } catch (e) {
          await page.fill('input[formcontrolname="serieComprobante"]', serie, { timeout: 8000 });
        }

        // Número
        try {
          await page.fill('input[name="numeroComprobante"]', String(numero), { timeout: 8000 });
        } catch (e) {
          await page.fill('input[formcontrolname="numeroComprobante"]', String(numero), { timeout: 8000 });
        }

        // Click en "Consultar"
        logger.info('[CPE SCRAPING] Haciendo click en Consultar...');
        try {
          await page.click('button.boton-primary:has-text("Consultar")', { timeout: 8000 });
        } catch (e) {
          await page.click('button[type="submit"]:has-text("Consultar")', { timeout: 8000 });
        }

        // Esperar respuesta de SUNAT (4 segundos)
        await page.waitForTimeout(4000);

        // ========== PASO 5: EXTRAER RESULTADO (Fiel a cpeScrapingHandler.js) ==========
        const resultado = await page.evaluate(() => {
          const body = document.body.innerText;
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

        logger.info(`[CPE SCRAPING] Resultado para ${serie}-${numero}: ${resultado.estado} (${resultado.razonSocial})`);

        // ========== DESCARGA NATIVA DE XML Y CDR (Fiel a cpeScrapingHandler.js) ==========
        let xmlPath = null;
        let cdrPath = null;
        let pdfPath = null;

        if (resultado.encontrado) {
          // Descargar XML
          try {
            const btnXml = await page.$('button[ngbtooltip="Descargar XML"]') || await page.$('button i.fa-file-code');
            if (btnXml) {
              const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
              await btnXml.click();
              const download = await downloadPromise;
              const fn = `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`;
              const dest = path.join(clientDownloadFolder, fn);
              await download.saveAs(dest);
              xmlPath = dest;
              logger.info(`[CPE SCRAPING] XML descargado: ${fn}`);
            }
          } catch (e) {}

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
              const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
              await btnCdr.click();
              const download = await downloadPromise;
              const fn = `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.zip`;
              const dest = path.join(clientDownloadFolder, fn);
              await download.saveAs(dest);
              cdrPath = dest;
              logger.info(`[CPE SCRAPING] CDR descargado: ${fn}`);
            }
          } catch (e) {}
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
        logger.warn(`[CPE SCRAPING] ⏱️ Timeout/Fallo en factura ${serie}-${numero} (<20s). Pasando a la siguiente: ${itemErr.message}`);
        resultados.push({
          id: factura.id,
          estado: 'PENDIENTE_REINTENTO',
          mensaje: 'SUNAT no respondió en 20s. Comprobante guardado como pendiente para reintentar.'
        });
      }
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
