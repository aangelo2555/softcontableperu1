const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger_web');
const config = require('./config');
const { buzonDir } = require('../server/storageConfig');
const sessionManager = require('./sessionManager');

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
   * Proceso principal para autenticar vía Playwright (Clave SOL) y descargar comprobantes de SUNAT
   */
  async descargarLoteCPE({ ruc, usuario, clave, facturas }) {
    logger.info(`[CPE PLAYWRIGHT] Iniciando proceso de scraping/consulta para RUC ${ruc} (${facturas.length} comprobantes)`);
    
    let browser = null;
    let page = null;
    let tokenJWT = null;
    let resultados = [];

    try {
      // 1. Obtención del Contexto Compartido mediante sessionManager
      const context = await sessionManager.createOrUpdateContext(ruc);
      page = await context.newPage();
      page.setDefaultTimeout(45000);

      // Verificamos si ya estamos autenticados intentando entrar al menú directo
      logger.info('[CPE] Verificando sesión existente en SUNAT...');
      await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', { waitUntil: 'load' });
      
      const isLogged = !page.url().includes('api-seguridad');

      if (!isLogged) {
          // Si no está logueado, hacemos el login SOL normal con Playwright
          logger.info('[CPE] Sesión no encontrada. Navegando a SUNAT login para obtener token CPE...');
          await page.goto('https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc8573727/oauth2/loginMenuSol?resume=/as/N1qK4/resume/as/authorization.ping', { waitUntil: 'load' });

          // Rellenar credenciales con manejo de reintentos
          await page.waitForSelector('#txtRuc', { state: 'visible' });
          await page.waitForTimeout(1500);
          
          for (let attempt = 1; attempt <= 3; attempt++) {
            await page.fill('#txtRuc', ruc.trim());
            await page.fill('#txtUsuario', (usuario || '').trim().toUpperCase());
            await page.fill('#txtContrasena', (clave || '').trim());
            await page.waitForTimeout(500);
            
            const filledRuc = await page.inputValue('#txtRuc').catch(() => '');
            const filledUser = await page.inputValue('#txtUsuario').catch(() => '');
            if (filledRuc === ruc.trim() && filledUser === (usuario || '').trim().toUpperCase()) {
              break;
            }
            logger.info(`[CPE] Campos vacíos o limpiados por SUNAT. Reintento de llenado ${attempt}/3...`);
          }
          
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }).catch(() => {}),
            page.click('#btnAceptar')
          ]);

          // --- MANEJO DE SESIÓN ACTIVA ---
          try {
            await page.waitForTimeout(3000);
            const sessionHandled = await page.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a'));
              const target = btns.find(b => {
                 const t = (b.value || b.innerText || '').toLowerCase();
                 return t.includes('continuar') || t.includes('cerrar sesi') || t.includes('aceptar');
              });
              if (target) { target.click(); return true; }
              return false;
            });
            if (sessionHandled) {
              logger.info('[CPE] Sesión activa manejada, esperando redirección...');
              await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            }
          } catch (e) {}

          // Escapar de OAuth si se quedó atascado
          if (page.url().includes('api-seguridad')) {
              logger.info('[CPE] Forzando navegación al menú SOL...');
              await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', { waitUntil: 'load', timeout: 60000 }).catch(() => {});
          }
      } else {
          logger.info('[CPE] ¡Sesión previa detectada y reutilizada con éxito!');
      }

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
                      logger.info('[CPE] ¡Token JWT interceptado exitosamente de la URL (GET)!');
                  }
              } catch (e) {}
          } else if (request.method() === 'POST' && !tokenJWT) {
              try {
                  const postData = request.postData();
                  if (postData && postData.includes('token=')) {
                      const params = new URLSearchParams(postData);
                      const token = params.get('token');
                      if (token && token.length > 50) {
                          tokenJWT = token;
                          logger.info('[CPE] ¡Token JWT interceptado exitosamente del Body (POST)!');
                      }
                  }
              } catch (e) {}
          }
      });

      // Navegación al módulo Consulta CPE mediante Enlace Directo
      try {
          logger.info('[CPE] Esperando carga del portal SOL y buscando iframe...');
          await page.waitForTimeout(4000); 
          
          logger.info('[CPE] Ejecutando navegación: Paso 1 - Click en el menú para cargar la pasarela...');
          
          try {
              await page.locator('text=/Nueva Consulta de comprobantes de pago/i').first().click({ force: true, timeout: 5000 });
          } catch (err) {
              logger.warn(`[CPE] No se encontró el texto en el menú, intentando fallback por ID: ${err.message}`);
              await page.evaluate(() => {
                  if (typeof window.$ !== 'undefined') {
                      $('#nivel4_11_38_1_1_1').trigger('click');
                  }
              });
          }
          
          logger.info('[CPE] Esperando inicialización de la pasarela...');
          await page.waitForTimeout(4000);
          
          logger.info('[CPE] Ejecutando navegación: Paso 2 - Inyectando deep link en el iframe...');
          const sParam = await page.evaluate(() => {
              const urlMatch = window.location.href.match(/[?&]s=([^&]+)/);
              if (urlMatch) return urlMatch[1];
              
              const sInput = document.querySelector('input[name="s"]');
              if (sInput && sInput.value) return sInput.value;
              
              for (const iframe of document.querySelectorAll('iframe')) {
                  const m = (iframe.src || '').match(/[?&]s=([^&]+)/);
                  if (m) return m[1];
              }
              return 'ww1';
          });
          
          const deepLink = `MenuInternet.htm?action=execute&code=11.38.1.1.1&s=${sParam}`;
          await page.evaluate((url) => {
              const iframe = document.getElementById('iframeApplication');
              if (iframe) {
                  iframe.src = url;
              } else {
                  window.location.href = `https://e-menu.sunat.gob.pe/cl-ti-itmenu/${url}`;
              }
          }, deepLink);
          
          await page.waitForTimeout(3000);

          // Paso 3: Navegación directa al portal CPE (según lógica de cpeScrapingHandler.js)
          const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
          try {
              await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
              await page.waitForTimeout(3000);
          } catch(e) {}
          
      } catch (e) {
          logger.warn(`[CPE] Error en navegación directa: ${e.message}`);
      }

      // Extraer token de sessionStorage / localStorage
      logger.info('[CPE] Esperando extracción de token en el iframe (o página principal)...');
      for (let i = 0; i < 15; i++) {
          if (tokenJWT) break;
          
          let framesToSearch = [page, ...page.frames()];
          
          for (const targetFrame of framesToSearch) {
              if (tokenJWT) break;
              
              try {
                  const frameUrl = targetFrame.url();
                  if (frameUrl.includes('token=')) {
                      const token = new URL(frameUrl).searchParams.get('token');
                      if (token && token.length > 50) {
                          tokenJWT = token;
                          logger.info('[CPE] ¡Token extraído de la URL!');
                          break;
                      }
                  }
              } catch(e) {}

              try {
                  const token = await targetFrame.evaluate(() => {
                      for (let j = 0; j < localStorage.length; j++) {
                          const k = localStorage.key(j);
                          if (k && k.toLowerCase().includes('token')) {
                              const v = localStorage.getItem(k);
                              if (v && v.length > 50) return v;
                          }
                      }
                      for (let j = 0; j < sessionStorage.length; j++) {
                          const k = sessionStorage.key(j);
                          if (k && k.toLowerCase().includes('token')) {
                              const v = sessionStorage.getItem(k);
                              if (v && v.length > 50) return v;
                          }
                      }
                      return null;
                  });
                  
                  if (token && token.length > 50) {
                      tokenJWT = token;
                      logger.info(`[CPE] ¡Token JWT extraído del Storage en el contexto ${targetFrame === page ? 'principal' : 'iframe'}!`);
                      break;
                  }
              } catch(e) {}
          }
          await page.waitForTimeout(1000);
      }

      if (!tokenJWT) {
          // DOM Fallback para interceptar token
          logger.warn('[CPE] Token no encontrado en Storage, intentando usar DOM Fallback para interceptarlo en red...');
          
          for (const factura of facturas) {
            if (tokenJWT) break;
            
            const { rucEmisor, tipoDoc, serie, numero } = factura;
            try {
              const targetContext = page.frames().find(f => f.url().includes('consultacpe') || f.name() === 'iframeApplication') || page;
              
              try {
                  await targetContext.click('label[for="recibido"]', { timeout: 8000, force: true });
              } catch (e) {
                  await targetContext.click('#recibido', { timeout: 8000, force: true }).catch(() => {});
              }
              
              try {
                  await targetContext.click('p-dropdown[formcontrolname="tipoComprobanteI"]', { timeout: 4000 });
                  if (tipoDoc === '01') {
                      await targetContext.locator('li').locator('text="Factura"').first().click({ timeout: 4000 });
                  }
              } catch (e) {}
              
              await targetContext.fill('input[formcontrolname="rucEmisor"]', rucEmisor).catch(() => {});
              await targetContext.fill('input[formcontrolname="serieComprobante"]', serie).catch(() => {});
              await targetContext.fill('input[formcontrolname="numeroComprobante"]', String(numero)).catch(() => {});
              
              await targetContext.click('button:has-text("Consultar")', { force: true }).catch(() => {});
              await page.waitForTimeout(4000);
            } catch (fallbackErr) {
              logger.error(`[CPE] Error en DOM Fallback: ${fallbackErr.message}`);
            }
          }
          
          if (!tokenJWT) {
              logger.error('[CPE] Falla crítica: No se pudo obtener el token JWT.');
              return facturas.map(f => ({ id: f.id, estado: 'ERROR_SIN_TOKEN_SOL' }));
          }
      }

      // 2. Ejecutar consultas y descargas usando el Token capturado a través de la API privada de SUNAT
      for (const factura of facturas) {
         const { rucEmisor, tipoDoc, serie, numero } = factura;
         
         // Formatear fecha a DD/MM/YYYY si viene en formato YYYY-MM-DD
         let fechaFormateada = factura.fechaEmision || '';
         if (fechaFormateada.includes('-')) {
             const parts = fechaFormateada.split('-');
             if (parts.length === 3 && parts[0].length === 4) {
                 fechaFormateada = `${parts[2]}/${parts[1]}/${parts[0]}`;
             }
         }

         logger.info(`[CPE] Consultando comprobante en SUNAT: Emisor ${rucEmisor} - ${tipoDoc} - ${serie}-${numero} (${fechaFormateada})`);
         
         try {
             const payload = {
                 "codComp": tipoDoc,
                 "numeroSerie": serie,
                 "numero": String(parseInt(numero, 10) || numero),
                 "fechaEmision": fechaFormateada,
                 "monto": String(Number(factura.total || 0).toFixed(2)),
                 "codTipoOpe": "2" // 2 = Recibido (Compras)
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
                 logger.info(`[CPE] Respuesta SUNAT para ${serie}-${numero}:`, JSON.stringify(resData));
                 
                 const codEstado = String(resData.codEstadoCpe || '');
                 const msjEstado = resData.msjEstadoCpe || (codEstado === '1' ? 'ACEPTADO' : codEstado === '2' ? 'ANULADO' : codEstado === '0' ? 'NO EXISTE' : 'CONSULTADO');

                 if (codEstado === "1" || resData.archivoXmlBase64) {
                     const cpeResult = {
                         id: factura.id,
                         estado: 'ACEPTADO',
                         mensaje: msjEstado,
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
                         estado: msjEstado.toUpperCase(),
                         mensaje: msjEstado
                     });
                 }
             } else {
                 const errText = await response.text().catch(() => '');
                 logger.warn(`[CPE] Error HTTP ${response.status()} de SUNAT: ${errText}`);
                 resultados.push({
                     id: factura.id,
                     estado: 'ERROR_SUNAT',
                     mensaje: `HTTP ${response.status()}`
                 });
             }
         } catch (err) {
             logger.error(`[CPE] Error procesando comprobante ${serie}-${numero}: ${err.message}`);
             resultados.push({
                 id: factura.id,
                 estado: 'ERROR_LOCAL',
                 mensaje: err.message
             });
         }
         
         await new Promise(r => setTimeout(r, 600));
      }

    } catch (error) {
      logger.error(`[CPE] Error general en descargarLoteCPE: ${error.message}`);
      throw error;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
