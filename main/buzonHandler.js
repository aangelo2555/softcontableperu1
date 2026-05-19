const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger_web');
const config = require('./config');
const emailService = require('./emailService');
const pdfMerger = require('./pdfMergerService');

/**
 * Handler avanzado para el módulo Buzón Electrónico SUNAT v3.0
 * Incluye unión de PDFs, extracción fallback y detección profunda de archivos.
 */
class BuzonHandler {
  constructor() {
    this.activeSessions = new Map(); // browserId -> { browser, page, cliente }
    this.downloadPath = path.join(process.cwd(), 'descargas_buzon');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
      logger.info('Directorio de descargas del buzón listo', { path: this.downloadPath });
    }
  }

  async capturarDebug(page, nombre = 'debug_error.png') {
    try {
      const screenshotPath = path.join(this.downloadPath, nombre);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info(`[SCRAPER] DEBUG: Captura guardada en: ${screenshotPath}`);
    } catch (e) {
      logger.error(`[SCRAPER] Error al capturar debug: ${e.message}`);
    }
  }

  async manejarIntersticiales(page) {
    try {
      logger.info('[SCRAPER] Buscando anuncios o popups de SUNAT...');
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
            logger.info(`[SCRAPER] Click en popup detected: ${selector}`);
            await page.click(selector);
            await page.waitForTimeout(2000);
          }
        } catch (e) {}
      }

      // Caso especial: Diálogos que no son botones
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('.modal-backdrop, .modal, .ui-widget-overlay');
        overlays.forEach(el => el.remove());
        document.body.classList.remove('modal-open');
      }).catch(() => {});

    } catch (e) {
      logger.error(`[SCRAPER] Error en manejarIntersticiales: ${e.message}`);
    }
  }

  async waitForFrame(page, predicate, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const frame = page.frames().find(predicate);
      if (frame) return frame;
      await page.waitForTimeout(500);
    }
    return null;
  }

  /**
   * Consulta el buzón v3.0
   */
  async consultarBuzon({ ruc: rucRaw, usuario: usuarioRaw, clave: claveRaw, email, empresa }) {
    const ruc = rucRaw?.trim() || '';
    const usuario = usuarioRaw?.trim().toUpperCase() || '';
    const clave = claveRaw?.trim() || '';

    let browser = null;
    let page = null;
    let context = null;

    try {
      logger.info('Iniciando consulta de buzón v3.0', { ruc, empresa });

      if (this.activeSessions.size > 0) {
        await this.cerrarTodasLasSesiones();
      }

      browser = await chromium.launch({
        headless: config.PLAYWRIGHT.headless,
        slowMo: 50,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1366,768'
        ]
      });

      context = await browser.newContext({
        acceptDownloads: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        extraHTTPHeaders: {
          'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Connection': 'keep-alive'
        }
      });
      
      page = await context.newPage();
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-PE', 'es', 'en'] });
      });

      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(90000);

      const portalUrl = config.PORTALES[3]; // Portal Buzón Directo
      logger.info('Navegando al portal v3.0...', { url: portalUrl });
      await page.goto(portalUrl, { waitUntil: 'domcontentloaded' });

      await page.waitForSelector('#txtRuc');
      await page.fill('#txtRuc', ruc);
      await page.fill('#txtUsuario', usuario);
      await page.fill('#txtContrasena', clave);

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { }),
        page.click('#btnAceptar')
      ]);

      // --- AVANZADO: MANEJO DE SESIÓN ACTIVA ---
      try {
        await page.waitForTimeout(4000);
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
          logger.info('[SCRAPER] Sesión activa manejada.');
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        }
      } catch (e) {}

      await page.waitForTimeout(3000);

      // --- AVANZADO: ESCAPE DE OAUTH ---
      let currentUrl = page.url();
      if (currentUrl.includes('api-seguridad') || currentUrl.includes('loginMenuSol')) {
        logger.warn('[SCRAPER] Detectado bloqueo OAuth, reintentando navegación directa...');
        await page.waitForTimeout(2000);
        await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 60000 });
      }

      await this.manejarIntersticiales(page);

      // --- ESTRATEGIA DE EXTRACCIÓN HÍBRIDA ---
      let mensajesDOM = await this.extraerCodigosMensajes(page);
      
      // Fallback 1: Buscar en iframes si el DOM principal falló
      if (mensajesDOM.length === 0) {
        logger.info('[SCRAPER] No se hallaron mensajes en el DOM principal, probando iframes...');
        mensajesDOM = await this.extraerMensajesDeIframes(page);
      }

      if (mensajesDOM.length === 0) {
        logger.warn('[SCRAPER] No se encontraron notificaciones disponibles.');
        return { success: true, mensajes: [], browserId: `buzon_${ruc}_${Date.now()}` };
      }

      const mensajes = [];
      const totalAProcesar = Math.min(mensajesDOM.length, 50);

      for (let i = 0; i < totalAProcesar; i++) {
        const msg = mensajesDOM[i];
        try {
           // Solo consultar si tenemos un ID numérico real
           if (/^\d+$/.test(msg.id)) {
              let detalle = await this.obtenerDetalleMensajeAPI(page, msg.id);
              
              // FALLBACK: Si la API falla o devuelve vacío, intentar Raspado Directo (DOM)
              if (!detalle || !detalle.contenido || detalle.contenido.length < 50) {
                 logger.info(`[SCRAPER] API falló para ${msg.id}, intentando Raspado Directo del DOM...`);
                 detalle = await this.obtenerDetalleMensajeDOM(page, msg.id);
              }

              if (detalle) {
                mensajes.push(detalle);
              } else {
                mensajes.push({ ...msg, contenido: 'No se pudo cargar el detalle' });
              }
           } else {
              mensajes.push(msg);
           }
        } catch (e) {
           mensajes.push({ ...msg, contenido: 'Error al procesar mensaje' });
        }
        if (i % 5 === 0) await page.waitForTimeout(300);
      }

      const browserId = `buzon_${ruc}_${Date.now()}`;
      this.activeSessions.set(browserId, { browser, page, ruc, context, empresa, email, cliente: { ruc, empresa } });

      if (mensajes.length > 0 && email && emailService.configured) {
          emailService.sendBuzonAlert(email, { ruc, empresa }, mensajes);
      }

      return { success: true, mensajes, browserId, cliente: { ruc, empresa } };
    } catch (error) {
      logger.error('Error al consultar buzón v3.0', { error: error.message, ruc });
      if (browser) await browser.close().catch(() => {});
      return { success: false, error: error.message };
    }
  }

  /**
   * Extrae códigos de mensajes numéricos (IDs nativos de SUNAT)
   */
  async extraerCodigosMensajes(page) {
    try {
      const frames = page.frames();
      let total = [];
      for(const frame of frames) {
        const found = await frame.evaluate(() => {
          const list = [];
          document.querySelectorAll('li.list-group-item[id]').forEach(li => {
            const id = li.id;
            if (id && /^\d{6,}$/.test(id)) {
              const asuntoEl = li.querySelector('.linkMensaje');
              const fechaEl = li.querySelector('.fecPublica');
              list.push({
                id: id,
                asunto: asuntoEl ? asuntoEl.textContent.trim() : 'Sin asunto',
                fecha: fechaEl ? fechaEl.textContent.trim() : '',
                tieneAdjunto: li.querySelector('.fa-paperclip') !== null
              });
            }
          });
          return list;
        });
        total = [...total, ...found];
      }
      return total;
    } catch (e) { return []; }
  }

  /**
   * Fallback de extracción desde iframes si falla el selector directo
   */
  async extraerMensajesDeIframes(page) {
    try {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;
        const result = await frame.evaluate(() => {
          const items = [];
          document.querySelectorAll('*').forEach((el, idx) => {
            const txt = (el.innerText || '');
            if (txt.includes('ASUNTO:') || txt.includes('Notificación')) {
              items.push({
                id: `bk_${idx}`,
                asunto: txt.substring(0, 150).replace('ASUNTO:', '').trim(),
                fecha: '',
                tieneAdjunto: txt.includes('Clip') || txt.includes('adjunto'),
                estado: 'no_leido'
              });
            }
          });
          return items.slice(0, 30);
        });
        if (result.length > 0) return result;
      }
      return [];
    } catch (e) { return []; }
  }

  /**
   * MÉTODO ROBUSTO: Raspado Directo (Interactuando con el Navegador)
   */
  async obtenerDetalleMensajeDOM(page, msgId) {
    try {
      // 1. Localizar el frame correcto (suele ser iframeApplication)
      const frame = await this.waitForFrame(page, f => f.name() === 'iframeApplication', 5000) || page.mainFrame();
      
      // 2. Hacer clic en el mensaje
      await frame.evaluate((id) => {
         const li = document.getElementById(id);
         if (li) {
            const lk = li.querySelector('.linkMensaje');
            if (lk) lk.click();
         }
      }, msgId);

      // 3. Esperar que se cargue el panel de detalle y el contenedor sea real
      await frame.waitForSelector('.contenedor-correo', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500); // Pequeño margen para estabilidad

      const panelVisible = await frame.isVisible('#detallePanel') || await frame.isVisible('.contenedor-correo');
      if (!panelVisible) return null;

      // 4. Extraer datos del DOM con limpieza de Menú
      const data = await frame.evaluate(() => {
         const title = document.getElementById('idTitleDetalle')?.innerText || '';
         const date = document.getElementById('idFechaDetalle')?.innerText || '';
         const contentEl = document.querySelector('.contenedor-correo');
         
         if (!contentEl) return null;

         const html = contentEl.innerHTML;
         // --- FILTRADO AGRESIVO DE MENÚS ---
         // Detectamos si el contenido capturado es en realidad el menú de navegación
         const isMenu = html.includes('Buzón Notificaciones') || 
                        html.includes('Mis Carpetas') || 
                        html.includes('id=&quot;tree') || 
                        html.includes('menu-item') ||
                        (contentEl.querySelectorAll('a').length > 10 && !html.includes('table'));

         if (isMenu) {
            // Intentar rescate: buscar el área de contenido real dentro del posible falso positivo
            const realContent = contentEl.querySelector('.msj-detalle, #idCuerpoMensaje, table.presentacion, .contenedor-correo-cuerpo');
            if (realContent && realContent.innerHTML.length > 100) {
               return { asunto: title, fecha: date, contenidoHtml: realContent.innerHTML, anexos: [] };
            }
            return null; // Rechazar si no hay rescate posible
         }

         // --- LIMPIEZA ADICIONAL: REMOVER SCRIPTS ---
         // Esto evita que posibles scripts de SUNAT redirijan el iframe al menú principal
         const cleanHtml = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '<!-- Script removed -->');

         // Capturar anexos del panel
         const anexos = [];

         document.querySelectorAll('#listArchivosAdjuntos li a').forEach(a => {
            const href = a.getAttribute('href') || '';
            const fullUrl = href.startsWith('http') ? href : `https://ww1.sunat.gob.pe${href.startsWith('/') ? '' : '/'}${href}`;
            const idArrMatch = href.match(/\/bajarArchivo\/(\d+)/);
            
            anexos.push({ 
               id: idArrMatch ? idArrMatch[1] : `ID_${Math.random().toString(36).substr(2, 9)}`, 
               nombre: a.innerText.trim(),
               url: fullUrl
            });
         });

         return {
            asunto: title,
            fecha: date,
            contenidoHtml: contentEl ? contentEl.innerHTML : '',
            anexos
         };
      });

      let contenido = data.contenidoHtml;

      // 5. Inlinar el iframe si existe y normalizar links internos
      if (contenido.includes('<iframe')) {
         try {
            logger.info(`[SCRAPER] Detectado iframe en DOM. Accediendo al marco interno...`);
            const docFrame = page.frames().find(f => f.name() === 'contenedorMensaje');
            
            if (docFrame) {
               await docFrame.waitForSelector('body', { timeout: 8000 }).catch(() => {});
               
               // Extraer el CONTENIDO COMPLETO (Documento) para preservar estilos internos
               const fullHtml = await docFrame.evaluate(() => document.documentElement.outerHTML);
               
               if (fullHtml && fullHtml.length > 100 && !fullHtml.includes('URL was rejected')) {
                   // --- ESTRATEGIA: PRIORIZAR DOCUMENTO LIMPIO ---
                   // Si encontramos el documento real dentro del iframe, REEMPLAZAMOS todo el contenido basura externo
                   // con solo el cuerpo del documento para evitar el "efecto comprimido" y el ruido del menú.
                   contenido = fullHtml;
                   logger.info(`[SCRAPER] Documento principal de SUNAT extraído y aislado con éxito.`);
                }
            }
         } catch (err) {
            logger.error(`[SCRAPER] Error al procesar frame interno: ${err.message}`);
         }
      }

      // Normalización Final del contenido principal (fuera del iframe)
      contenido = contenido.replace(/href="\/(ol-ti-itvisornoti|cl-ti-iagenerador)/g, 'href="https://ww1.sunat.gob.pe/$1');
      contenido = contenido.replace(/src="\/(ol-ti-itvisornoti|cl-ti-iagenerador)/g, 'src="https://ww1.sunat.gob.pe/$1');

      return {
         id: msgId,
         asunto: data.asunto,
         fecha: data.fecha,
         contenido: contenido,
         anexos: data.anexos,
         tieneAdjunto: data.anexos.length > 0,
         estado: 'leido'
      };
    } catch (e) {
      logger.error(`[SCRAPER] Error en Raspado DOM (${msgId}): ${e.message}`);
      return null;
    }
  }

  /**
   * Consulta API para detalle v3.0 (con Recuperación UTF8 y Extracción de IFRAME)
   */
  async obtenerDetalleMensajeAPI(page, codigoMensaje) {
    try {
      const currentOrigin = await page.evaluate(() => window.location.origin);
      const baseUrl = currentOrigin.includes('sunat.gob.pe') ? currentOrigin : 'https://ww1.sunat.gob.pe';
      const timestamp = Date.now();
      
      let apiUrl = `${baseUrl}/ol-ti-itvisornoti/visor/obtenerDetalleNotiMen?codigoMensaje=${codigoMensaje}&tipoMsj=2&_=${timestamp}`;
      let response = await this.peticiónAPI(page, apiUrl);
      
      if (!response || !response.data || response.data.includes('"mensaje":""')) {
         apiUrl = `${baseUrl}/ol-ti-itvisornoti/visor/obtenerDetalleNotiMen?codigoMensaje=${codigoMensaje}&tipoMsj=1&_=${timestamp}`;
         response = await this.peticiónAPI(page, apiUrl);
      }

      if (!response || !response.ok) return null;

      let data;
      try { data = JSON.parse(response.data); } catch (e) { return null; }
      
      let contenido = data.mensaje || data.desMensaje || data.html || '';
      let asunto = data.asunto || 'Sin asunto';

      try {
        contenido = decodeURIComponent(escape(contenido));
        asunto = decodeURIComponent(escape(asunto));
      } catch (e) {}

      // --- AVANZADO: DETECCIÓN DE IFRAME (FORZAR FALLBACK DOM) ---
      if (contenido.includes('<iframe')) {
         logger.info(`[SCRAPER] Mensaje ${codigoMensaje} contiene iframe. Forzando fallback a DOM para evitar bloqueo WAF.`);
         return null; // Forzamos el uso de obtenerDetalleMensajeDOM
      }

      const anexos = (data.anexos || []).map(a => ({
          id: a.id_archivo || a.idArchivo,
          nombre: a.nombre || a.nomArchivo || 'archivo.pdf'
      }));

      // --- AVANZADO: REVISIÓN DE ADJUNTOS EN HTML ---
      if (contenido.includes('/bajarArchivo/')) {
        const matches = contenido.matchAll(/\/bajarArchivo\/(\d+)\/(\d+)\/(\d+)\/(\d+)/g);
        for (const match of matches) {
           const idArr = match[1];
           if (!anexos.find(ax => ax.id == idArr)) {
              anexos.push({ id: idArr, nombre: `Adjunto_${idArr}.pdf` });
           }
        }
      }

      return {
        id: codigoMensaje,
        asunto,
        fecha: data.fecha || '',
        tieneAdjunto: anexos.length > 0 || (data.indicadorAdjunto === '1'),
        anexos,
        contenido,
        estado: 'no_leido'
      };
    } catch (e) { 
      logger.error(`[SCRAPER] Error en API (${codigoMensaje}): ${e.message}`);
      return null; 
    }
  }

  /**
   * Petición Segura (Bypass CORS y Manejo de Sesión)
   */
  async peticiónAPI(page, url) {
    try {
      // Usar el contexto de la página (cookies compartidas) pero llamar desde el proceso principal
      // para evitar bloqueos de CORS del navegador (Electron no bloquea peticiones internas via request)
      const response = await page.request.get(url, {
         headers: {
           'X-Requested-With': 'XMLHttpRequest',
           'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
         }
      });

      if (!response.ok()) {
         logger.warn(`[SCRAPER] Petición falló: ${url} (Status: ${response.status()})`);
         return { ok: false };
      }

      return { ok: true, data: await response.text() };
    } catch (e) {
      logger.error(`[SCRAPER] Error de red: ${e.message}`);
      return { ok: false };
    }
  }

  /**
   * Descarga Avanzada v3.0: Click + Detalle + Unión PDF
   */
  async descargarAdjunto({ browserId, mensajeId }) {
    try {
      const session = this.activeSessions.get(browserId);
      if (!session) return { success: false, error: 'Sesión no encontrada' };

      const { page, cliente } = session;
      const clientePath = path.join(this.downloadPath, cliente.ruc);
      if (!fs.existsSync(clientePath)) fs.mkdirSync(clientePath, { recursive: true });

      const frameToUse = await this.waitForFrame(page, (f) => f.name() === 'iframeApplication', 5000) || page.mainFrame();

      // Click para cargar detalle y ver anexos ocultos
      await frameToUse.evaluate((id) => {
        const li = document.getElementById(id);
        if (li) {
          const lk = li.querySelector('.linkMensaje');
          if (lk) lk.click();
        }
      }, mensajeId);
      await page.waitForTimeout(2000);

      // Extraer fecha real para el nombre
      const fechaFull = await frameToUse.evaluate(() => document.getElementById('idFechaDetalle')?.textContent.trim() || '');
      const fechaPrefix = fechaFull.replace(/[^0-9]/g, '').substring(0, 14);

      // Buscar todos los targets (Links + Cartas en iframes)
      const targets = await frameToUse.evaluate(() => {
        const list = [];
        const seen = new Set();
        document.querySelectorAll('a[href*="bajarArchivo"], a[href*=".pdf"]').forEach(a => {
          if (!seen.has(a.href)) { seen.add(a.href); list.push({ type: 'link', url: a.href, name: a.innerText }); }
        });
        document.querySelectorAll('iframe').forEach(ifr => {
          try {
            const src = ifr.src || '';
            if (src.includes('gendocS01Alias') && src.includes('datos=')) {
              const urlObj = new URL(src, document.location.href);
              const d = JSON.parse(urlObj.searchParams.get('datos'));
              const down = `${window.location.origin}/ol-ti-itvisornoti/visor/bajarArchivo/${d.id_archivo}/0/0/${d.numruc}`;
              if (!seen.has(down)) { seen.add(down); list.push({ type: 'carta', url: down, name: `Carta_${d.num_doc || d.id_archivo}` }); }
            }
          } catch(e){}
        });
        return list;
      });

      if (targets.length === 0) return { success: false, error: 'No se hallaron adjuntos' };

      const downloaded = [];
      for (const target of targets) {
        try {
          const dlPromise = page.waitForEvent('download', { timeout: 15000 });
          await frameToUse.evaluate((u) => { const a = document.createElement('a'); a.href = u; a.click(); }, target.url);
          const dl = await dlPromise;
          let suggested = dl.suggestedFilename();
          if (target.type === 'carta' && fechaPrefix) suggested = `Carta_${target.name}_${fechaPrefix}.pdf`;
          
          const unique = `${path.basename(suggested, path.extname(suggested))}_${Date.now()}_${Math.floor(Math.random()*1000)}${path.extname(suggested)}`;
          const finalPath = path.join(clientePath, unique);
          await dl.saveAs(finalPath);
          downloaded.push({ archivo: suggested, ruta: finalPath });
        } catch(e){}
      }

      // UNIÓN DE PDFs
      let mergedInfo = null;
      let displayPath = downloaded.map(f => f.ruta).join('<br/>');
      if (downloaded.length >= 2) {
        const pdfs = downloaded.filter(f => f.ruta.toLowerCase().endsWith('.pdf')).map(f => f.ruta);
        if (pdfs.length >= 2) {
          const res = await pdfMerger.mergeInPairs(pdfs, clientePath);
          if (res.success && res.generatedFiles.length > 0) {
             mergedInfo = res.generatedFiles[0];
             displayPath = `<b>FUSIÓN:</b> ${mergedInfo.name}<br/><hr/>${displayPath}`;
          }
        }
      }

      return { success: true, ruta: displayPath, archivo: mergedInfo ? `[UNIDO] ${mergedInfo.name}` : downloaded.map(f => f.archivo).join(', ') };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extrae el HTML del detalle de un mensaje
   */
  async extraerDetalleMensaje(browserId, mensajeId) {
    try {
      const session = this.activeSessions.get(browserId);
      if (!session) return { success: false, error: 'Sesión no encontrada' };

      const { page } = session;

      let targetFrame = null;
      for (const frame of page.frames()) {
        if (frame.name() === 'iframeApplication') {
          targetFrame = frame;
          break;
        }
      }
      const frameToUse = targetFrame || page.mainFrame();

      // Click
      await frameToUse.evaluate((msgId) => {
        const li = document.getElementById(msgId);
        if (li) {
          const lk = li.querySelector('.linkMensaje');
          if (lk) { lk.click(); return true; }
        }
        return false;
      }, mensajeId);

      await page.waitForTimeout(1500);

      const { htmlContent, baseUri } = await frameToUse.evaluate(() => {
        const padre = document.getElementById('contenedorPadre');
        const content = padre ? padre.outerHTML : document.body.innerHTML;
        return { htmlContent: content, baseUri: document.baseURI || window.location.href };
      });

      let finalHtml = htmlContent || '';
      if (finalHtml && !finalHtml.includes('<base ')) {
        finalHtml = `
          <head>
            <base href="${baseUri}" />
            <meta charset="utf-8">
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; background: transparent; overflow-x: hidden; margin: 0; padding: 10px; }
              #contenedorPadre { width: 100%; max-width: 100%; box-sizing: border-box; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>${!finalHtml.includes('<body') ? finalHtml : ''}
        `;
        if (htmlContent.includes('<body')) {
            finalHtml = htmlContent.replace('<head>', `<head><base href="${baseUri}" />`);
            if (finalHtml === htmlContent) finalHtml = `<head><base href="${baseUri}" /></head>` + htmlContent;
        }
      }

      return { success: true, html: finalHtml };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Lista las constancias en el directorio del cliente
   */
  async listarConstancias(ruc) {
    try {
      const clientePath = path.join(this.downloadPath, ruc);
      if (!fs.existsSync(clientePath)) {
        return { success: true, constancias: [] };
      }

      const archivos = fs.readdirSync(clientePath);
      const constancias = archivos.map(archivo => {
        const ruta = path.join(clientePath, archivo);
        const stat = fs.statSync(ruta);
        return {
          nombre: archivo,
          ruta: ruta,
          tamano: (stat.size / 1024).toFixed(2) + ' KB',
          fecha: stat.mtime.toLocaleDateString() + ' ' + stat.mtime.toLocaleTimeString()
        };
      });

      // Ordenar por fecha más reciente
      constancias.sort((a, b) => {
        const statA = fs.statSync(a.ruta);
        const statB = fs.statSync(b.ruta);
        return statB.mtime - statA.mtime;
      });

      return { success: true, constancias };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Abre un documento en el sistema nativo
   */
  async abrirConstancia(ruta) {
    try {
      if (process.versions.electron) {
        const lib = 'electron';
        const { shell } = require(lib);
        if (!fs.existsSync(ruta)) {
          return { success: false, error: 'El archivo ya no existe en el disco.' };
        }
        await shell.openPath(ruta);
        return { success: true };
      } else {
        // En modo servidor, esto se manejaría vía descarga desde el navegador
        return { success: false, error: 'La apertura nativa no está disponible en modo web. Descargue el archivo desde la tabla de constancias.' };
      }
    } catch(e) { 
      return { success: false, error: e.message }; 
    }
  }

  async cerrarTodasLasSesiones() {
    for (const [id, session] of this.activeSessions.entries()) {
      try { await session.browser.close(); } catch (e) {}
    }
    this.activeSessions.clear();
  }
}

module.exports = new BuzonHandler();
