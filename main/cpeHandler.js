const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger_web');
const config = require('./config');
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

  async capturarDebug(page, nombre = 'cpe_debug.png') {
    try {
      const screenshotPath = path.join(this.downloadPath, nombre);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info(`[CPE] Captura debug guardada en: ${screenshotPath}`);
    } catch (e) {
      logger.error(`[CPE] Error capturando debug: ${e.message}`);
    }
  }

  /**
   * Proceso principal para obtener el Token y descargar lote de comprobantes
   */
  async descargarLoteCPE({ ruc, usuario, clave, facturas }) {
    logger.info(`[CPE] Iniciando proceso de descarga de lote para RUC ${ruc}`);
    
    let browser = null;
    let page = null;
    let tokenJWT = null;
    let resultados = [];

    try {
      browser = await chromium.launch({
        headless: config.PLAYWRIGHT?.headless ?? true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ]
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 }
      });

      page = await context.newPage();
      page.setDefaultTimeout(45000);

      // 1. Obtención del Token interceptando la redirección
      logger.info('[CPE] Navegando a SUNAT login para obtener token CPE...');
      await page.goto('https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc8573727/oauth2/loginMenuSol?resume=/as/N1qK4/resume/as/authorization.ping', { waitUntil: 'load' });

      // Rellenar credenciales (esperar y reintentar si es necesario)
      await page.waitForSelector('#txtRuc', { state: 'visible' });
      await page.fill('#txtRuc', ruc.trim());
      await page.fill('#txtUsuario', usuario.trim().toUpperCase());
      await page.fill('#txtContrasena', clave.trim());
      await page.click('#btnAceptar');

      // Esperamos que la autenticación nos redirija a la interfaz de Consulta CPE donde en la URL viaja el token
      // O bien, esperamos directamente que cargue nuevaconsulta.html
      let tokenObtenido = false;
      
      // Hook interceptor para cazar la URL que contenga ?token=
      page.on('framenavigated', async (frame) => {
          const url = frame.url();
          if (url.includes('nuevaconsulta.html?token=')) {
              try {
                  const urlObj = new URL(url);
                  tokenJWT = urlObj.searchParams.get('token');
                  if (tokenJWT) {
                      logger.info('[CPE] ¡Token JWT interceptado exitosamente de la URL!');
                      tokenObtenido = true;
                  }
              } catch (e) {
                  logger.error('[CPE] Error extrayendo token de URL:', e);
              }
          }
      });

      // Navegar forzadamente al módulo si no redirigió solo
      if (!tokenObtenido) {
         try {
             await page.waitForSelector('iframe[name="iframeApplication"]', { timeout: 15000 });
             // Hemos entrado a Clave SOL antigua
             logger.info('[CPE] Redirigiendo manualmente a ConsultaCpe...');
             await page.goto('https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/loader/nuevaconsulta.html');
             
             // Extraer token de session storage si no está en URL
             await page.waitForTimeout(5000); // Dar tiempo a Angular
             if (!tokenJWT) {
                 tokenJWT = await page.evaluate(() => {
                     return sessionStorage.getItem('token') || localStorage.getItem('token');
                 });
             }
         } catch(e) {
             logger.warn('[CPE] No se encontró el iframe, asumiendo login directo SPA');
         }
      }

      // 1.5 Si falló la extracción rápida, buscar el token en el DOM / localStorage
      if (!tokenJWT) {
          const currentUrl = page.url();
          if (currentUrl.includes('token=')) {
              tokenJWT = new URL(currentUrl).searchParams.get('token');
          } else {
             await page.waitForTimeout(3000);
             tokenJWT = await page.evaluate(() => sessionStorage.getItem('token') || localStorage.getItem('token') || window.token);
          }
      }

      if (!tokenJWT) {
          await this.capturarDebug(page, 'cpe_token_fail.png');
          
          // ESTRATEGIA DE RESPALDO (DOM FALLBACK)
          logger.warn('[CPE] Token no encontrado, intentando usar DOM Fallback (UI navigation)');
          
          for (const factura of facturas) {
            const { rucEmisor, tipoDoc, serie, numero } = factura;
            logger.info(`[CPE] DOM Fallback consultando comprobante: ${rucEmisor} - ${tipoDoc} - ${serie}-${numero}`);
            try {
              // 1. Click en recibido
              await page.click('#recibido');
              // 2. Rellenar datos
              await page.fill('[formcontrolname="rucEmisor"]', rucEmisor);
              // Wait for dropdown to be ready if needed, or fill manually
              // assuming tipoDoc "01" is default or handled
              await page.fill('[formcontrolname="serieComprobante"]', serie);
              await page.fill('[formcontrolname="numeroComprobante"]', numero);
              
              // 3. Click search
              await page.click('button:has-text("Buscar")');
              await page.waitForTimeout(3000); // wait for results
              
              // This is a naive implementation since we don't have the full response handling logic here yet
              resultados.push({
                 id: factura.id,
                 estado: 'PENDIENTE_FALLBACK',
                 xmlPath: null,
                 cdrPath: null,
                 pdfPath: null
              });
            } catch (fallbackErr) {
              logger.error(`[CPE] Error en DOM Fallback: ${fallbackErr.message}`);
              resultados.push({ id: factura.id, estado: 'ERROR_FALLBACK' });
            }
          }
          
          return resultados;
      }

      // 2. Ejecutar descargas usando el Token capturado a través de la API REST de SUNAT
      for (const factura of facturas) {
         const { rucEmisor, tipoDoc, serie, numero } = factura;
         logger.info(`[CPE] Consultando comprobante API: ${rucEmisor} - ${tipoDoc} - ${serie}-${numero}`);
         
         try {
             const payload = {
                 "codComp": tipoDoc,           // "01", "03", "07", etc.
                 "numeroSerie": serie,         // "F001"
                 "numero": numero,             // "84"
                 "fechaEmision": factura.fechaEmision, // "12/08/2026"
                 "monto": factura.total || 0,
                 "codTipoOpe": "2"             // 2 = Recibido
             };

             const response = await page.request.post(`https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe/consulta/comprobante`, {
                 headers: {
                     'Authorization': `Bearer ${tokenJWT}`,
                     'Content-Type': 'application/json',
                     'Accept': 'application/json, text/plain, */*'
                 },
                 data: {
                     rucEmisor,
                     numDocIdeReceptor: ruc,
                     ...payload
                 }
             });

             if (response.ok()) {
                 const resData = await response.json();
                 if (resData && resData.codEstadoCpe === "1") { // ACEPTADO
                     logger.info(`[CPE] Factura ${serie}-${numero} ACEPTADA. Procesando archivos...`);
                     
                     const cpeResult = {
                         id: factura.id,
                         estado: 'ACEPTADO',
                         xmlPath: null,
                         cdrPath: null,
                         pdfPath: null
                     };
                     
                     if (resData.archivoXmlBase64) {
                         const xmlBuffer = Buffer.from(resData.archivoXmlBase64, 'base64');
                         const fileName = `${rucEmisor}-${tipoDoc}-${serie}-${numero}.xml`;
                         const filePath = path.join(this.downloadPath, fileName);
                         fs.writeFileSync(filePath, xmlBuffer);
                         cpeResult.xmlPath = filePath;
                     }
                     if (resData.archivoCdrBase64) {
                         const cdrBuffer = Buffer.from(resData.archivoCdrBase64, 'base64');
                         const fileName = `R-${rucEmisor}-${tipoDoc}-${serie}-${numero}.zip`;
                         const filePath = path.join(this.downloadPath, fileName);
                         fs.writeFileSync(filePath, cdrBuffer);
                         cpeResult.cdrPath = filePath;
                     }

                     resultados.push(cpeResult);
                 } else {
                     resultados.push({
                         id: factura.id,
                         estado: resData.msjEstadoCpe || 'RECHAZADO/NO_EXISTE'
                     });
                 }
             } else {
                 resultados.push({
                     id: factura.id,
                     estado: 'ERROR_API_SUNAT'
                 });
             }
         } catch (err) {
             logger.error(`[CPE] Error procesando factura API ${serie}-${numero}: ${err.message}`);
             resultados.push({
                 id: factura.id,
                 estado: 'ERROR_LOCAL'
             });
         }
         
         // Evitar colapsar la API
         await new Promise(r => setTimeout(r, 800));
      }

    } catch (error) {
      logger.error(`[CPE] Error general en descargarLoteCPE: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
