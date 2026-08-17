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
   * Proceso principal para obtener el Token y descargar lote de comprobantes
   */
  async descargarLoteCPE({ ruc, usuario, clave, facturas }) {
    logger.info(`[CPE] Iniciando proceso de descarga de lote para RUC ${ruc}`);
    
    let browser = null;
    let page = null;
    let tokenJWT = null;
    let resultados = [];

    try {
      // 1. Obtención del Contexto Compartido
      const context = await sessionManager.createOrUpdateContext(ruc);
      page = await context.newPage();
      page.setDefaultTimeout(45000);

      // Verificamos si ya estamos autenticados intentando entrar al menú directo
      logger.info('[CPE] Verificando sesión existente en SUNAT...');
      await page.goto('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', { waitUntil: 'load' });
      
      const isLogged = !page.url().includes('api-seguridad');

      if (!isLogged) {
          // Si no está logueado, hacemos el login normal
          logger.info('[CPE] Sesión no encontrada. Navegando a SUNAT login para obtener token CPE...');
          await page.goto('https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc8573727/oauth2/loginMenuSol?resume=/as/N1qK4/resume/as/authorization.ping', { waitUntil: 'load' });

          // Rellenar credenciales con manejo de navegación y scripts onload de SUNAT
          await page.waitForSelector('#txtRuc', { state: 'visible' });
          await page.waitForTimeout(1500); // Dar tiempo a que SUNAT termine de cargar sus scripts
          
          for (let attempt = 1; attempt <= 3; attempt++) {
            await page.fill('#txtRuc', ruc.trim());
            await page.fill('#txtUsuario', usuario.trim().toUpperCase());
            await page.fill('#txtContrasena', clave.trim());
            await page.waitForTimeout(500);
            
            const filledRuc = await page.inputValue('#txtRuc').catch(() => '');
            const filledUser = await page.inputValue('#txtUsuario').catch(() => '');
            if (filledRuc === ruc.trim() && filledUser === usuario.trim().toUpperCase()) {
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

      // 1. Esperar a que cargue el menú de SUNAT (Clave SOL)
      try {
          logger.info('[CPE] Esperando carga del portal SOL y buscando iframe...');
          await page.waitForTimeout(5000); 
          
          logger.info('[CPE] Ejecutando navegación al módulo Consulta CPE mediante Enlace Directo...');
          
          // Navegación directa recomendada por el usuario, preservando la sesión (parámetro s)
          const sParam = await page.evaluate(() => {
              const urlMatch = window.location.href.match(/[?&]s=([^&]+)/);
              if (urlMatch) return urlMatch[1];
              
              const sInput = document.querySelector('input[name="s"]');
              if (sInput && sInput.value) return sInput.value;
              
              for (const iframe of document.querySelectorAll('iframe')) {
                  const m = (iframe.src || '').match(/[?&]s=([^&]+)/);
                  if (m) return m[1];
              }
              return 'ww1'; // Default fallback
          });
          
          const deepLink = `MenuInternet.htm?action=execute&code=11.38.1.1.1&s=${sParam}`;
          logger.info(`[CPE] Inyectando deep link en el src del iframe: ${deepLink}`);
          
          await page.evaluate((url) => {
              const iframe = document.getElementById('iframeApplication');
              if (iframe) {
                  iframe.src = url;
              } else {
                  // Fallback extremo si no hay iframe (poco probable dado el layout de SUNAT)
                  window.location.href = `https://e-menu.sunat.gob.pe/cl-ti-itmenu/${url}`;
              }
          }, deepLink);
          
          // Dar tiempo extra para que la redirección cross-domain hacia e-factura ocurra
          await page.waitForTimeout(3000);
          
      } catch (e) {
          logger.warn(`[CPE] Error en navegación directa: ${e.message}`);
      }

      // 2. Esperar pacientemente a que el iframe cargue y extraer el token de su sessionStorage
      logger.info('[CPE] Esperando extracción de token en el iframe (o página principal)...');
      for (let i = 0; i < 20; i++) {
          if (tokenJWT) break;
          
          let framesToSearch = [page, ...page.frames()];
          
          for (const targetFrame of framesToSearch) {
              if (tokenJWT) break;
              
              // 1. Intento por URL (si es frame)
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

              // 2. Intento por localStorage/sessionStorage
              try {
                  const token = await targetFrame.evaluate(() => {
                      // Buscar en localStorage
                      for (let j = 0; j < localStorage.length; j++) {
                          const k = localStorage.key(j);
                          if (k && k.toLowerCase().includes('token')) {
                              const v = localStorage.getItem(k);
                              if (v && v.length > 50) return v;
                          }
                      }
                      // Buscar en sessionStorage
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
              } catch(e) {
                  // Ignorar errores de cross-origin si el frame aún no está listo
              }
          }
          await page.waitForTimeout(1000);
      }

      if (!tokenJWT) {
          // ESTRATEGIA DE RESPALDO (DOM FALLBACK)
          logger.warn('[CPE] Token no encontrado en Storage, intentando usar DOM Fallback para interceptarlo en red...');
          
          for (const factura of facturas) {
            if (tokenJWT) break; // Si ya lo interceptó, salimos del fallback!
            
            const { rucEmisor, tipoDoc, serie, numero } = factura;
            logger.info(`[CPE] DOM Fallback consultando comprobante para forzar red: ${rucEmisor} - ${tipoDoc} - ${serie}-${numero}`);
            try {
              // 1. Encontrar el contexto (Angular renderiza en el iframe o directo en la página principal)
              const targetContext = page.frames().find(f => f.url().includes('consultacpe') || f.name() === 'iframeApplication') || page;
              
              // 2. Click en "Recibido" (hacer click en el LABEL, ya que el input puede estar oculto por Bootstrap)
              try {
                  await targetContext.click('label[for="recibido"]', { timeout: 10000, force: true });
              } catch (e) {
                  await targetContext.click('#recibido', { timeout: 10000, force: true });
              }
              
              // 3. Seleccionar tipo de comprobante (Dropdown de PrimeNG)
              try {
                  // Abrir dropdown
                  await targetContext.click('p-dropdown[formcontrolname="tipoComprobanteI"]', { timeout: 5000 });
                  // Si es factura (01), buscar en la lista
                  if (tipoDoc === '01') {
                      await targetContext.locator('li').locator('text="Factura"').first().click({ timeout: 5000 });
                  }
              } catch (e) {
                  logger.warn(`[CPE] No se pudo seleccionar tipo de comprobante en UI: ${e.message}`);
              }
              
              // 4. Rellenar datos
              await targetContext.fill('input[formcontrolname="rucEmisor"]', rucEmisor);
              await targetContext.fill('input[formcontrolname="serieComprobante"]', serie);
              await targetContext.fill('input[formcontrolname="numeroComprobante"]', numero);
              
              // 5. Click Consultar
              await targetContext.click('button:has-text("Consultar")', { force: true });
              
              // Esperar a que la red intercepte el token
              await page.waitForTimeout(5000);
              
            } catch (fallbackErr) {
              logger.error(`[CPE] Error en DOM Fallback: ${fallbackErr.message}`);
            }
          }
          
          if (!tokenJWT) {
              logger.error('[CPE] Falla crítica: No se pudo obtener el token JWT ni por Storage ni por red.');
              return facturas.map(f => ({ id: f.id, estado: 'ERROR_SIN_TOKEN' }));
          }
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
