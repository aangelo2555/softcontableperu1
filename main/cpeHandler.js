const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger_web');
const { buzonDir } = require('../server/storageConfig');

class CpeHandler {
  constructor() {
    this.downloadPath = path.join(buzonDir, 'cpe_downloads');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
      logger.info('Directorio de descargas CPE listo', { path: this.downloadPath });
    }
  }

  /**
   * Helper para descargar archivo nativo (XML, CDR, PDF) tras la consulta en SUNAT
   */
  async _descargarArchivoNativo(page, tipoArchivo, destinationFolder, baseFilename) {
    try {
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

      if (!btn) return null;

      const isDisabled = await btn.evaluate(b => b.hasAttribute('disabled') || b.classList.contains('disabled')).catch(() => false);
      if (isDisabled) return null;

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      let clicked = false;
      try {
        if (btn.click) {
          await btn.click();
          clicked = true;
        }
      } catch (e) {}

      if (!clicked) {
        await btn.evaluate(b => b.click());
      }

      const download = await downloadPromise;
      const suggestedFilename = download.suggestedFilename();
      const serverExtension = path.extname(suggestedFilename) || (tipoArchivo === 'cdr' ? '.zip' : `.${tipoArchivo}`);
      
      const filename = `${baseFilename}${serverExtension}`;
      const filePath = path.join(destinationFolder, filename);

      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }

      await download.saveAs(filePath);
      logger.info(`[CPE SCRAPING] ${tipoArchivo.toUpperCase()} descargado exitosamente: ${filename}`);
      return filePath;
    } catch (e) {
      logger.warn(`[CPE SCRAPING] No se pudo descargar ${tipoArchivo}: ${e.message}`);
      return null;
    }
  }

  /**
   * Proceso de scraping fiel a consultas/cpeScrapingHandler.js
   * 1. Login en SOL
   * 2. Navegación directa a la interfaz de Nueva Consulta
   * 3. Relleno de campos en Angular
   * 4. Extracción de resultados desde el modal
   * 5. Descarga de XML y CDR
   */
  async descargarLoteCPE({ ruc, usuario, clave, facturas }) {
    logger.info(`[CPE SCRAPING] Iniciando procesamiento de ${facturas.length} comprobante(s) para RUC ${ruc}`);
    
    const clientDownloadFolder = path.join(this.downloadPath, ruc);
    if (!fs.existsSync(clientDownloadFolder)) {
      fs.mkdirSync(clientDownloadFolder, { recursive: true });
    }

    let browser = null;
    let page = null;
    const resultados = [];

    try {
      browser = await chromium.launch({
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

      page = await context.newPage();

      // Anti-detección estándar de consultas
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      });

      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(90000);

      // ========== PASO 1: LOGIN EN SUNAT SOL ==========
      const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
      logger.info(`[CPE SCRAPING] PASO 1: Navegando al login SUNAT ${loginUrl}`);
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForSelector('#txtRuc', { timeout: 35000 });

      logger.info(`[CPE SCRAPING] Rellenando credenciales SOL: ${ruc} - ${usuario}`);
      await page.fill('#txtRuc', ruc.trim());
      await page.waitForTimeout(300);
      await page.fill('#txtUsuario', (usuario || '').trim().toUpperCase());
      await page.waitForTimeout(300);
      await page.fill('#txtContrasena', (clave || '').trim());
      await page.waitForTimeout(300);

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}),
        page.click('#btnAceptar')
      ]);

      await page.waitForTimeout(3000);

      // Si se queda en api-seguridad OAuth, forzar navegación al menú
      let currentUrl = page.url();
      if (currentUrl.includes('api-seguridad')) {
        logger.info('[CPE SCRAPING] Detectada página OAuth, forzando redirección al menú principal...');
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);
      }

      logger.info('[CPE SCRAPING] Login completado exitosamente.');

      // ========== PASO 2: NAVEGACIÓN DIRECTA A LA INTERFAZ ==========
      const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
      logger.info(`[CPE SCRAPING] PASO 2: Navegando directamente a la interfaz: ${consultaUrl}`);
      await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(3000);

      // ========== PASO 3: NAVEGAR AL PORTAL CPE ANGULAR ==========
      const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
      logger.info(`[CPE SCRAPING] PASO 3: Navegando al portal CPE: ${cpeUrl}`);
      await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(5000);

      // ========== PASO 4: PROCESAR CADA COMPROBANTE ==========
      for (let i = 0; i < facturas.length; i++) {
        const factura = facturas[i];
        const { rucEmisor, tipoDoc = '01', serie, numero } = factura;
        logger.info(`[CPE SCRAPING] (${i + 1}/${facturas.length}) Consultando: ${rucEmisor} - ${tipoDoc} - ${serie}-${numero}`);

        try {
          // 1. Si no estamos en la página del formulario, recargarla
          if (!page.url().includes('nuevaconsulta')) {
            await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(3000);
          }

          // 2. Cerrar cualquier modal previo si estuviera abierto
          try {
            await page.click('button.close', { timeout: 1500 });
            await page.waitForTimeout(500);
          } catch (e) {}

          // 3. Seleccionar "Recibido"
          try {
            await page.click('label[for="recibido"]', { timeout: 5000 });
          } catch (e) {
            await page.click('#recibido', { timeout: 5000 }).catch(() => {});
          }

          // 4. Rellenar RUC Emisor
          try {
            await page.fill('input[name="rucEmisor"]', rucEmisor);
          } catch (e) {
            await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor);
          }

          // 5. Tipo Comprobante
          try {
            const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito', 'R1': 'Recibo por Honorarios' };
            const tipoLabel = tipoLabels[tipoDoc] || 'Factura';

            await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]', { timeout: 3000 });
            await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 2000 }).catch(() => page.click(`text=${tipoLabel}`));
          } catch (e) {
            logger.warn(`[CPE SCRAPING] Error seleccionando tipo comprobante: ${e.message}`);
          }

          // 6. Serie
          try {
            await page.fill('input[name="serieComprobante"]', serie);
          } catch (e) {
            await page.fill('input[formcontrolname="serieComprobante"]', serie);
          }

          // 7. Número
          try {
            await page.fill('input[name="numeroComprobante"]', String(numero));
          } catch (e) {
            await page.fill('input[formcontrolname="numeroComprobante"]', String(numero));
          }

          // 8. Click en "Consultar"
          logger.info('[CPE SCRAPING] Haciendo click en Consultar...');
          try {
            await page.click('button.boton-primary:has-text("Consultar")');
          } catch (e) {
            await page.click('button[type="submit"]:has-text("Consultar")');
          }

          // 9. Esperar resultado
          await page.waitForTimeout(4000);

          // 10. Extraer resultado del DOM
          const resultado = await page.evaluate(() => {
            const body = document.body.innerText;
            const modal = document.querySelector('div[role="document"].modal-dialog');

            if (!modal) {
              if (body.includes('No se encontr') || body.includes('sin resultados') || body.includes('no existe') || body.includes('no existe registro')) {
                return { estado: 'NO_EXISTE', encontrado: false, razonSocial: '', importeTotal: '' };
              }
              if (body.includes('ACEPTADO')) return { estado: 'ACEPTADO', encontrado: true, razonSocial: '', importeTotal: '' };
              return { estado: 'NO_ENCONTRADO', encontrado: false, razonSocial: '', importeTotal: '' };
            }

            const datos = {
              estado: 'ENCONTRADO',
              encontrado: true,
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
            } else {
              datos.estado = 'ACEPTADO';
            }

            return datos;
          });

          logger.info(`[CPE SCRAPING] Resultado para ${serie}-${numero}: ${resultado.estado} (${resultado.razonSocial})`);

          // 11. Descargar XML y CDR si el modal está abierto
          let xmlPath = null;
          let cdrPath = null;
          let pdfPath = null;

          const baseFilename = `${rucEmisor}-${tipoDoc}-${serie}-${numero}`;

          if (resultado.encontrado) {
            xmlPath = await this._descargarArchivoNativo(page, 'xml', clientDownloadFolder, baseFilename);
            cdrPath = await this._descargarArchivoNativo(page, 'cdr', clientDownloadFolder, `R-${baseFilename}`);
            pdfPath = await this._descargarArchivoNativo(page, 'pdf', clientDownloadFolder, baseFilename);
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
          logger.error(`[CPE SCRAPING] Error procesando comprobante ${serie}-${numero}: ${itemErr.message}`);
          resultados.push({
            id: factura.id,
            estado: 'ERROR',
            mensaje: itemErr.message
          });
        }
      }

    } catch (error) {
      logger.error(`[CPE SCRAPING] Error general: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
