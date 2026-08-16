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

      // Hook interceptor robusto para cazar el token JWT de la red
      page.on('request', async (request) => {
          const url = request.url();
          const authHeader = request.headers()['authorization'];
          
          if (authHeader && authHeader.startsWith('Bearer ') && !tokenJWT) {
              tokenJWT = authHeader.substring(7);
              logger.info('[CPE] ¡Token JWT interceptado de los Headers HTTP (API Request)!');
          } else if (url.includes('token=') && !tokenJWT) {
              try {
                  const urlObj = new URL(url);
                  const token = urlObj.searchParams.get('token');
                  if (token && token.length > 50) {
                      tokenJWT = token;
                      logger.info('[CPE] ¡Token JWT interceptado exitosamente de la URL!');
                  }
              } catch (e) {}
          }
      });

      // 1. Esperar a que cargue el menú de SUNAT (Clave SOL)
      try {
          logger.info('[CPE] Esperando carga del portal SOL...');
          await page.waitForTimeout(8000); // Dar 8 segundos para que cargue el layout principal de SUNAT
          
          logger.info('[CPE] Ejecutando navegación al módulo Consulta CPE...');
          await page.evaluate(() => {
              // 1. Intentar hacer click en el ID si existe
              const btn = document.querySelector('#nivel4_11_38_1_1_1');
              if (btn) {
                  const span = btn.querySelector('.spanNivelDescripcion');
                  if (span) { span.click(); return; }
                  btn.click(); return;
              }
              
              // 2. Intentar buscar por texto
              const spans = Array.from(document.querySelectorAll('span'));
              const target = spans.find(s => s.textContent && s.textContent.includes('Nueva Consulta de comprobantes'));
              if (target) {
                  target.click(); return;
              }
              
              // 3. Bala de plata: Forzar el iframe a cargar la acción que genera el token
              const iframe = document.getElementById('iframeApplication');
              if (iframe) {
                  iframe.src = 'MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
              }
          });
      } catch (e) {
          logger.warn(`[CPE] Error en inyección de navegación: ${e.message}`);
      }

      // 2. Esperar pacientemente a que el iframe cargue y extraer el token de su sessionStorage
      logger.info('[CPE] Esperando extracción de token en el iframe...');
      for (let i = 0; i < 20; i++) {
          if (tokenJWT) break;
          
          const frame = page.frame({ name: 'iframeApplication' });
          if (frame) {
              try {
                  const token = await frame.evaluate(() => {
                      return sessionStorage.getItem('token') || localStorage.getItem('token');
                  });
                  if (token && token.length > 50) {
                      tokenJWT = token;
                      logger.info('[CPE] ¡Token JWT extraído directamente del sessionStorage del iframe!');
                      break;
                  }
              } catch(e) {
                  // Ignorar errores de cross-origin si el frame aún no está listo
              }
          }
          await page.waitForTimeout(1000);
      }

      if (!tokenJWT) {
          await this.capturarDebug(page, 'cpe_token_fail.png');
          
          // ESTRATEGIA DE RESPALDO (DOM FALLBACK)
          logger.warn('[CPE] Token no encontrado, intentando usar DOM Fallback (UI navigation)');
          
          for (const factura of facturas) {
            const { rucEmisor, tipoDoc, serie, numero } = factura;
            logger.info(`[CPE] DOM Fallback consultando comprobante: ${rucEmisor} - ${tipoDoc} - ${serie}-${numero}`);
            try {
              // 1. Encontrar el contexto del iframe
              let frame = page.frame({ name: 'iframeApplication' });
              if (!frame) {
                  frame = page.frames().find(f => f.url().includes('consultacpe') || f.url().includes('MenuInternet'));
              }
              const targetContext = frame || page;
              
              // 2. Click en recibido dentro del iframe
              try {
                  await targetContext.click('#recibido', { timeout: 3000 });
              } catch (e) {
                  // Fallback al texto visible
                  await targetContext.locator('text="Recibido"').first().click({ timeout: 5000 });
              }
              // 3. Rellenar datos
              await targetContext.fill('[formcontrolname="rucEmisor"]', rucEmisor);
              await targetContext.fill('[formcontrolname="serieComprobante"]', serie);
              await targetContext.fill('[formcontrolname="numeroComprobante"]', numero);
              
              // 4. Click search
              await targetContext.click('button:has-text("Buscar")');
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
