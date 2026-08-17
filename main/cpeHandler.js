const path = require('path');
const fs = require('fs');
const logger = require('./logger_web');
const { buzonDir } = require('../server/storageConfig');
const sessionManager = require('./sessionManager');

class CpeHandler {
  constructor() {
    this.downloadPath = path.join(buzonDir, 'cpe_downloads');
    this.activePages = new Map(); // ruc -> page
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
      logger.info('Directorio de descargas CPE listo', { path: this.downloadPath });
    }
  }

  /**
   * Helper para buscar el contexto que contiene los inputs (sea en página principal o iframe)
   */
  async _findTargetContext(page) {
    const inputSelector = 'input[name="rucEmisor"], input[formcontrolname="rucEmisor"], #rucEmisor';
    
    // Primero verificar página principal
    try {
      const el = await page.$(inputSelector);
      if (el) return page;
    } catch (e) {}

    // Luego verificar frames/iframes
    for (const frame of page.frames()) {
      try {
        const el = await frame.$(inputSelector);
        if (el) return frame;
      } catch (e) {}
    }
    return page;
  }

  /**
   * Helper para descargar archivo nativo (XML, CDR, PDF) tras la consulta en SUNAT
   */
  async _descargarArchivoNativo(contextOrPage, tipoArchivo, destinationFolder, baseFilename) {
    try {
      let btn = null;
      if (tipoArchivo === 'pdf') {
        btn = await contextOrPage.$('button[ngbtooltip="Descargar PDF"]') || await contextOrPage.$('button i.fa-file-pdf');
      } else if (tipoArchivo === 'xml') {
        btn = await contextOrPage.$('button[ngbtooltip="Descargar XML"]') || await contextOrPage.$('button i.fa-file-code');
      } else if (tipoArchivo === 'cdr') {
        btn = await contextOrPage.evaluateHandle(() => {
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

      const page = contextOrPage.page ? contextOrPage.page() : contextOrPage;
      const downloadPromise = page.waitForEvent('download', { timeout: 8000 });
      
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
      logger.info(`[CPE SCRAPING] ${tipoArchivo.toUpperCase()} descargado: ${filename}`);
      return filePath;
    } catch (e) {
      logger.warn(`[CPE SCRAPING] No se pudo descargar ${tipoArchivo}: ${e.message}`);
      return null;
    }
  }

  /**
   * Obtener o inicializar la página de navegación activa en el portal de CPE
   * Garantiza login exitoso y carga del formulario Angular
   */
  async _getOrInitActivePage(ruc, usuario, clave) {
    let page = this.activePages.get(ruc);

    // 1. Si ya existe una página activa, verificar si el formulario ya está visible
    if (page && !page.isClosed()) {
      try {
        const target = await this._findTargetContext(page);
        const hasForm = await target.$('input[name="rucEmisor"], input[formcontrolname="rucEmisor"]');
        if (hasForm) {
          logger.info(`[CPE SCRAPING] Reutilizando instancia activa de Chromium en el formulario CPE para RUC ${ruc}`);
          return page;
        }
      } catch (e) {
        this.activePages.delete(ruc);
      }
    }

    logger.info(`[CPE SCRAPING] Iniciando sesión nueva en SUNAT SOL para RUC ${ruc}...`);
    const context = await sessionManager.createOrUpdateContext(ruc);
    page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.setDefaultNavigationTimeout(45000);

    // Anti-detección estándar
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    // 1. Login en SOL
    const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
    logger.info(`[CPE SCRAPING] Navegando a ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Esperar explícitamente el input #txtRuc
    logger.info(`[CPE SCRAPING] Esperando formulario de login SOL...`);
    await page.waitForSelector('#txtRuc', { state: 'visible', timeout: 25000 });

    logger.info(`[CPE SCRAPING] Ingresando credenciales SOL: ${ruc} / ${usuario}`);
    await page.fill('#txtRuc', ruc.trim());
    await page.waitForTimeout(200);
    await page.fill('#txtUsuario', (usuario || '').trim().toUpperCase());
    await page.waitForTimeout(200);
    await page.fill('#txtContrasena', (clave || '').trim());
    await page.waitForTimeout(200);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}),
      page.click('#btnAceptar')
    ]);

    await page.waitForTimeout(3000);

    // Manejar posible popup de sesión activa
    try {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a'));
        const target = btns.find(b => {
          const t = (b.value || b.innerText || '').toLowerCase();
          return t.includes('continuar') || t.includes('cerrar sesi') || t.includes('aceptar');
        });
        if (target) target.click();
      });
      await page.waitForTimeout(2000);
    } catch (e) {}

    // Si quedó en api-seguridad OAuth, forzar menú principal
    if (page.url().includes('api-seguridad')) {
      logger.info('[CPE SCRAPING] Forzando redirección al menú principal...');
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    logger.info('[CPE SCRAPING] Login completado. Navegando al portal de Consulta de Comprobantes...');

    // 2. Navegación directa al enlace del módulo
    const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
    await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
    await page.waitForTimeout(2500);

    // 3. Navegación al portal CPE Angular
    const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
    logger.info(`[CPE SCRAPING] Cargando interfaz CPE: ${cpeUrl}`);
    await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // 4. Esperar a que el formulario cargue completamente
    logger.info('[CPE SCRAPING] Esperando renderizado del formulario Angular...');
    const target = await this._findTargetContext(page);
    await target.waitForSelector('input[name="rucEmisor"], input[formcontrolname="rucEmisor"], #rucEmisor', { timeout: 20000 });
    logger.info('[CPE SCRAPING] ¡Formulario Angular listo para consultas en vivo!');

    this.activePages.set(ruc, page);
    return page;
  }

  /**
   * Proceso de scraping rápido con límite de 10s por factura y persistencia de navegador
   */
  async descargarLoteCPE({ ruc, usuario, clave, facturas }) {
    logger.info(`[CPE SCRAPING] Procesando ${facturas.length} comprobante(s) (máx 10s c/u) para RUC ${ruc}`);
    
    const clientDownloadFolder = path.join(this.downloadPath, ruc);
    if (!fs.existsSync(clientDownloadFolder)) {
      fs.mkdirSync(clientDownloadFolder, { recursive: true });
    }

    const resultados = [];
    let page = null;

    try {
      page = await this._getOrInitActivePage(ruc, usuario, clave);
    } catch (errInit) {
      logger.error(`[CPE SCRAPING] Error al inicializar sesión en SUNAT: ${errInit.message}`);
      return facturas.map(f => ({
        id: f.id,
        estado: 'PENDIENTE_REINTENTO',
        mensaje: `Error al conectar con SUNAT (${errInit.message}). Queda pendiente para reintentar.`
      }));
    }

    // Procesar cada factura con tiempo máximo de 10 segundos
    for (let i = 0; i < facturas.length; i++) {
      const factura = facturas[i];
      const { rucEmisor, tipoDoc = '01', serie, numero } = factura;
      logger.info(`[CPE SCRAPING] (${i + 1}/${facturas.length}) Procesando ${rucEmisor} - ${tipoDoc} - ${serie}-${numero}`);

      try {
        const target = await this._findTargetContext(page);

        // 1. Cerrar cualquier modal previo
        try {
          const closeBtn = await target.$('button.close, button[data-dismiss="modal"], .modal-header button');
          if (closeBtn) await closeBtn.click().catch(() => {});
        } catch (e) {}

        // 2. Seleccionar "Recibido" con timeout de 3s
        try {
          await target.click('label[for="recibido"], #recibido', { timeout: 3000 });
        } catch (e) {}

        // 3. Rellenar RUC Emisor con timeout de 4s
        await target.fill('input[name="rucEmisor"], input[formcontrolname="rucEmisor"], #rucEmisor', rucEmisor, { timeout: 4000 });

        // 4. Tipo Comprobante con timeout de 3s
        const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito', 'R1': 'Recibo por Honorarios' };
        const tipoLabel = tipoLabels[tipoDoc] || 'Factura';
        try {
          await target.click('p-dropdown[formcontrolname="tipoComprobanteI"], #tipoComprobanteI', { timeout: 2500 });
          await target.click(`li[aria-label="${tipoLabel}"], text="${tipoLabel}"`, { timeout: 2500 });
        } catch (e) {}

        // 5. Serie con timeout de 3s
        await target.fill('input[name="serieComprobante"], input[formcontrolname="serieComprobante"], #serieComprobante', serie, { timeout: 3000 });

        // 6. Número con timeout de 3s
        await target.fill('input[name="numeroComprobante"], input[formcontrolname="numeroComprobante"], #numeroComprobante', String(numero), { timeout: 3000 });

        // 7. Click en Consultar con timeout de 3s
        await target.click('button.boton-primary:has-text("Consultar"), button[type="submit"]:has-text("Consultar"), button:has-text("Consultar")', { timeout: 3000 });

        // 8. Esperar respuesta de SUNAT (3 segundos)
        await page.waitForTimeout(3000);

        // 9. Extraer resultado del modal
        const resultado = await target.evaluate(() => {
          const body = document.body ? document.body.innerText : '';
          const modal = document.querySelector('div[role="document"].modal-dialog, .modal-content');

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

          if (body.includes('ANULADO') || body.includes('BAJA')) {
            datos.estado = 'ANULADO';
          } else {
            datos.estado = 'ACEPTADO';
          }

          return datos;
        });

        logger.info(`[CPE SCRAPING] Resultado para ${serie}-${numero}: ${resultado.estado} (${resultado.razonSocial})`);

        // 10. Descargas de XML y CDR
        let xmlPath = null;
        let cdrPath = null;
        let pdfPath = null;
        const baseFilename = `${rucEmisor}-${tipoDoc}-${serie}-${numero}`;

        if (resultado.encontrado) {
          xmlPath = await this._descargarArchivoNativo(target, 'xml', clientDownloadFolder, baseFilename);
          cdrPath = await this._descargarArchivoNativo(target, 'cdr', clientDownloadFolder, `R-${baseFilename}`);
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
        logger.warn(`[CPE SCRAPING] ⏱️ Timeout/Fallo en comprobante ${serie}-${numero} (<10s). Pasando al siguiente: ${itemErr.message}`);
        resultados.push({
          id: factura.id,
          estado: 'PENDIENTE_REINTENTO',
          mensaje: 'SUNAT no respondió en 10s. Comprobante guardado como pendiente para reintentar.'
        });
      }
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
