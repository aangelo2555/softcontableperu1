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
   * Helper que espera y localiza el contexto (página principal o iframe) donde Angular renderiza los inputs
   */
  async _waitForInputTarget(page, selector, timeout = 25000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      // 1. Revisar en página principal
      try {
        const el = await page.$(selector);
        if (el) return { target: page, element: el };
      } catch (e) {}

      // 2. Revisar en todos los frames activos
      for (const frame of page.frames()) {
        try {
          const el = await frame.$(selector);
          if (el) return { target: frame, element: el };
        } catch (e) {}
      }

      // 3. Revisar en el iframe de la aplicación SOL (#iframeApplication)
      try {
        const iframeHandle = await page.$('#iframeApplication, iframe[name="iframeApplication"], iframe');
        if (iframeHandle) {
          const frame = await iframeHandle.contentFrame();
          if (frame) {
            const el = await frame.$(selector);
            if (el) return { target: frame, element: el };
          }
        }
      } catch (e) {}

      await page.waitForTimeout(500);
    }
    throw new Error(`Timeout ${timeout}ms esperando elemento: ${selector}`);
  }

  /**
   * Helper para descargar archivo nativo (XML, CDR, PDF) tras la consulta en SUNAT
   */
  async _descargarArchivoNativo(target, page, tipoArchivo, destinationFolder, baseFilename) {
    try {
      let btn = null;
      if (tipoArchivo === 'pdf') {
        btn = await target.$('button[ngbtooltip="Descargar PDF"]') || await target.$('button i.fa-file-pdf');
      } else if (tipoArchivo === 'xml') {
        btn = await target.$('button[ngbtooltip="Descargar XML"]') || await target.$('button i.fa-file-code');
      } else if (tipoArchivo === 'cdr') {
        btn = await target.evaluateHandle(() => {
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

      const rootPage = page || (target.page ? target.page() : target);
      const downloadPromise = rootPage.waitForEvent('download', { timeout: 8000 });
      
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
   * Obtener o inicializar la página de navegación activa en el portal de CPE
   */
  async _getOrInitActivePage(ruc, usuario, clave) {
    let page = this.activePages.get(ruc);

    // 1. Si ya existe una página abierta, probar si los inputs responden de inmediato
    if (page && !page.isClosed()) {
      try {
        const check = await this._waitForInputTarget(page, 'input[name="rucEmisor"], input[formcontrolname="rucEmisor"], #rucEmisor', 2000);
        if (check && check.target) {
          logger.info(`[CPE SCRAPING] Reutilizando instancia abierta y activa de Chromium en el formulario CPE para RUC ${ruc}`);
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
    
    // Esperar input #txtRuc
    logger.info(`[CPE SCRAPING] Esperando formulario de login SOL...`);
    await page.waitForSelector('#txtRuc', { state: 'visible', timeout: 25000 });
    await page.waitForTimeout(500);

    // Llenado con verificación
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.fill('#txtRuc', ruc.trim());
      await page.fill('#txtUsuario', (usuario || '').trim().toUpperCase());
      await page.fill('#txtContrasena', (clave || '').trim());
      await page.waitForTimeout(400);

      const filledRuc = await page.inputValue('#txtRuc').catch(() => '');
      if (filledRuc === ruc.trim()) break;
    }

    logger.info(`[CPE SCRAPING] Enviando login para ${ruc} / ${usuario}...`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.click('#btnAceptar')
    ]);

    await page.waitForTimeout(3000);

    // Manejar popup de sesión activa si aparece
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
      logger.info('[CPE SCRAPING] Redirigiendo al menú principal...');
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    logger.info('[CPE SCRAPING] Login completado. Navegando al portal de Consulta de Comprobantes...');

    // 2. Navegación directa al módulo CPE
    const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
    await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
    await page.waitForTimeout(2500);

    // 3. Navegación al portal CPE Angular
    const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
    logger.info(`[CPE SCRAPING] Cargando interfaz CPE: ${cpeUrl}`);
    await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});

    // 4. Esperar y confirmar que el formulario Angular esté presente (sea en page o iframe)
    logger.info('[CPE SCRAPING] Esperando renderizado de campos del formulario...');
    await this._waitForInputTarget(page, 'input[name="rucEmisor"], input[formcontrolname="rucEmisor"], #rucEmisor', 25000);
    logger.info('[CPE SCRAPING] ¡Formulario Angular detectado y listo!');

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
        // Localizar el contexto dinámicamente (page o iframe)
        const check = await this._waitForInputTarget(page, 'input[name="rucEmisor"], input[formcontrolname="rucEmisor"], #rucEmisor', 4000);
        const target = check.target;

        // 1. Cerrar cualquier modal previo
        try {
          const closeBtn = await target.$('button.close, button[data-dismiss="modal"], .modal-header button');
          if (closeBtn) await closeBtn.click().catch(() => {});
        } catch (e) {}

        // 2. Seleccionar "Recibido"
        try {
          await target.click('label[for="recibido"], #recibido', { timeout: 2500 });
        } catch (e) {}

        // 3. Rellenar RUC Emisor
        await target.fill('input[name="rucEmisor"], input[formcontrolname="rucEmisor"], #rucEmisor', rucEmisor, { timeout: 3500 });

        // 4. Tipo Comprobante
        const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito', 'R1': 'Recibo por Honorarios' };
        const tipoLabel = tipoLabels[tipoDoc] || 'Factura';
        try {
          await target.click('p-dropdown[formcontrolname="tipoComprobanteI"], #tipoComprobanteI', { timeout: 2500 });
          await target.click(`li[aria-label="${tipoLabel}"], text="${tipoLabel}"`, { timeout: 2500 });
        } catch (e) {}

        // 5. Serie
        await target.fill('input[name="serieComprobante"], input[formcontrolname="serieComprobante"], #serieComprobante', serie, { timeout: 2500 });

        // 6. Número
        await target.fill('input[name="numeroComprobante"], input[formcontrolname="numeroComprobante"], #numeroComprobante', String(numero), { timeout: 2500 });

        // 7. Click en Consultar
        await target.click('button.boton-primary:has-text("Consultar"), button[type="submit"]:has-text("Consultar"), button:has-text("Consultar")', { timeout: 2500 });

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
          xmlPath = await this._descargarArchivoNativo(target, page, 'xml', clientDownloadFolder, baseFilename);
          cdrPath = await this._descargarArchivoNativo(target, page, 'cdr', clientDownloadFolder, `R-${baseFilename}`);
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
