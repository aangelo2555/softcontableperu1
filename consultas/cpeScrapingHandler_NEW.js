// NUEVA IMPLEMENTACIÓN DE consultarMasivo - COPIAR Y REEMPLAZAR EN cpeScrapingHandler.js

/**
 * Consulta masiva usando procesamiento paralelo en cascada
 * Cada browser se inicia inmediatamente después del login del anterior
 * NO hace descargas automáticas - los browsers quedan abiertos
 * Los browsers se cierran automáticamente después de detectar descargas manuales
 * @param {string} sessionId - NO USADO (mantener por compatibilidad)
 * @param {Array} listaComprobantes - Lista de comprobantes [{rucEmisor, tipoDoc, serie, numero, filtro}]
 * @param {Object} cliente - Datos del cliente (puede ser solo {ruc} o {ruc, usuario, clave})
 */
async consultarMasivo(sessionId, listaComprobantes, cliente) {
    logger.info(`🚀 Iniciando consulta masiva PARALELA de ${listaComprobantes.length} comprobantes...`);

    // Validar que al menos tengamos el RUC
    if (!cliente || !cliente.ruc) {
        return {
            success: false,
            error: 'Se requiere el RUC del cliente consultante'
        };
    }

    // Si no se enviaron credenciales, buscarlas automáticamente en API_SIRE.xlsm
    let credencialesCompletas = cliente;
    if (!cliente.usuario || !cliente.clave) {
        logger.info(`Buscando credenciales para RUC: ${cliente.ruc} en API_SIRE.xlsm...`);
        const credResult = await this.obtenerCredenciales(cliente.ruc);

        if (!credResult.success) {
            return {
                success: false,
                error: `No se encontraron credenciales para RUC ${cliente.ruc} en API_SIRE.xlsm`
            };
        }

        credencialesCompletas = credResult.data;
        logger.info(`✅ Credenciales obtenidas exitosamente para ${credResult.data.razonSocial}`);
    }

    const MAX_BROWSERS_SIMULTANEOS = 10; // Máximo de browsers trabajando en paralelo
    const resultados = [];
    let browsersActivos = 0;

    try {
        // Función para procesar una factura individual
        const procesarFactura = async (cpe, idx) => {
            const uniqueSessionId = `cpe_mass_${credencialesCompletas.ruc}_${Date.now()}_${idx}`;
            let browser = null;
            let page = null;
            let descargasRealizadas = 0;

            try {
                const { rucEmisor, tipoDoc, serie, numero, filtro = 'recibido' } = cpe;
                logger.info(`🌐 Browser ${idx + 1}: Iniciando para ${rucEmisor}-${tipoDoc}-${serie}-${numero}`);

                // Lanzar navegador
                browser = await chromium.launch({
                    headless: false, // Visible para que el usuario pueda descargar manualmente
                    slowMo: 50,
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

                // Anti-detección
                await page.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                });

                page.setDefaultTimeout(60000);
                page.setDefaultNavigationTimeout(90000);

                // ========== CONFIGURAR LISTENER DE DESCARGAS (AUTO-CLOSE) ==========
                // Este listener detecta cuando el usuario descarga archivos manualmente
                page.on('download', async (download) => {
                    descargasRealizadas++;
                    const filename = download.suggestedFilename();
                    logger.info(`📥 Browser ${idx + 1}: Detectada descarga manual: ${filename} (${descargasRealizadas}/3)`);

                    // Crear directorio de descargas si no existe
                    const tempPath = path.join(this.downloadPath, credencialesCompletas.ruc);
                    if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });

                    // Guardar archivo con nomenclatura estándar
                    const ext = path.extname(filename);
                    const finalFilename = `${rucEmisor}-${tipoDoc}-${serie}-${numero}${ext}`;
                    const finalFilePath = path.join(tempPath, finalFilename);

                    try {
                        await download.saveAs(finalFilePath);
                        logger.info(`✅ Browser ${idx + 1}: Archivo guardado: ${finalFilename}`);
                    } catch (err) {
                        logger.warn(`⚠️ Browser ${idx + 1}: Error guardando descarga: ${err.message}`);
                    }

                    // Si se descargaron 3 archivos (PDF, XML, CDR), cerrar browser automáticamente
                    if (descargasRealizadas >= 3) {
                        logger.info(`🔒 Browser ${idx + 1}: 3 archivos descargados, cerrando browser automáticamente...`);
                        setTimeout(async () => {
                            try {
                                this.activeSessions.delete(uniqueSessionId);
                                await browser.close();
                                logger.info(`✅ Browser ${idx + 1}: Cerrado automáticamente`);
                            } catch (e) { }
                        }, 2000); // Esperar 2 segundos para que termine la última descarga
                    }
                });

                // ========== PASO 1: LOGIN EN SUNAT SOL ==========
                const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
                logger.info(`Browser ${idx + 1}: PASO 1 - Navegando al login SUNAT`);

                await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
                await page.waitForSelector('#txtRuc', { timeout: 30000 });

                // Rellenar formulario de login
                await page.fill('#txtRuc', credencialesCompletas.ruc);
                await page.waitForTimeout(500);
                await page.fill('#txtUsuario', credencialesCompletas.usuario_sol);
                await page.waitForTimeout(500);
                await page.fill('#txtContrasena', credencialesCompletas.clave_sol);
                await page.waitForTimeout(500);

                logger.info(`Browser ${idx + 1}: Enviando login...`);

                // Click en login
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => { }),
                    page.click('#btnAceptar')
                ]);

                await page.waitForTimeout(3000);

                let currentUrl = page.url();
                logger.info(`Browser ${idx + 1}: URL después de login: ${currentUrl}`);

                // Si estamos en api-seguridad (OAuth), navegar al menú principal
                if (currentUrl.includes('api-seguridad')) {
                    logger.info(`Browser ${idx + 1}: Detectada página OAuth, navegando al menú principal...`);
                    const menuUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
                    await page.goto(menuUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    await page.waitForTimeout(3000);
                }

                logger.info(`Browser ${idx + 1}: Login exitoso`);

                // ========== PASO 2: NAVEGACIÓN DIRECTA A LA INTERFAZ ==========
                logger.info(`Browser ${idx + 1}: PASO 2 - Navegando directamente a la interfaz de consulta...`);

                const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
                await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
                await page.waitForTimeout(3000);

                // ========== PASO 3: NAVEGAR AL PORTAL CPE ==========
                const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
                logger.info(`Browser ${idx + 1}: PASO 3 - Navegando al portal CPE...`);

                await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
                await page.waitForTimeout(5000);

                // ========== PASO 4: RELLENAR FORMULARIO DE CONSULTA ==========
                logger.info(`Browser ${idx + 1}: PASO 4 - Rellenando formulario...`);

                // Seleccionar "Recibido" o "Emitido"
                if (filtro === 'recibido') {
                    try {
                        await page.click('label[for="recibido"]');
                    } catch (e) {
                        await page.click('#recibido');
                    }
                } else {
                    try {
                        await page.click('label[for="emitido"]');
                    } catch (e) {
                        await page.click('#emitido');
                    }
                }

                // Rellenar RUC Emisor
                try {
                    await page.fill('input[name="rucEmisor"]', rucEmisor);
                } catch (e) {
                    await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor);
                }

                // Tipo Comprobante
                try {
                    const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de créd ito', '08': 'Nota de débito' };
                    const tipoLabel = tipoLabels[tipoDoc] || 'Factura';

                    await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]');
                    await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 2000 }).catch(() => page.click(`text=${tipoLabel}`));
                } catch (e) {
                    logger.warn(`Browser ${idx + 1}: Error seleccionando tipo comprobante: ${e.message}`);
                }

                // Serie
                try {
                    await page.fill('input[name="serieComprobante"]', serie);
                } catch (e) {
                    await page.fill('input[formcontrolname="serieComprobante"]', serie);
                }

                // Número
                try {
                    await page.fill('input[name="numeroComprobante"]', numero);
                } catch (e) {
                    await page.fill('input[formcontrolname="numeroComprobante"]', numero);
                }

                // Click en "Consultar"
                logger.info(`Browser ${idx + 1}: Haciendo click en Consultar...`);
                try {
                    await page.click('button.boton-primary:has-text("Consultar")');
                } catch (e) {
                    await page.click('button[type="submit"]:has-text("Consultar")');
                }

                // Esperar resultado
                await page.waitForTimeout(3000);

                // ========== PASO 5: EXTRAER RESULTADO ==========
                const resultado = await page.evaluate(() => {
                    const body = document.body.innerText;
                    const modal = document.querySelector('div[role="document"].modal-dialog');

                    if (!modal) {
                        if (body.includes('No se encontr') || body.includes('sin resultados') || body.includes('no existe') || body.includes('no existe registro')) {
                            return { estado: 'NO_ENCONTRADO', encontrado: false };
                        }
                        if (body.includes('ACEPTADO')) return { estado: 'ACEPTADO', encontrado: true };
                        return { estado: 'PENDIENTE_REVISION', encontrado: false };
                    }

                    const datos = {
                        estado: 'ENCONTRADO',
                        encontrado: true,
                        html: modal.outerHTML,
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
                    }

                    return datos;
                });

                logger.info(`✅ Browser ${idx + 1}: Completado ${rucEmisor}-${tipoDoc}-${serie}-${numero} - Estado: ${resultado.estado}`);

                // Guardar sesión activa (el browser queda abierto para descarga manual)
                this.activeSessions.set(uniqueSessionId, {
                    browser,
                    page,
                    context,
                    cliente: credencialesCompletas,
                    cpe: cpe
                });
                logger.info(`🔓 Browser ${idx + 1}: ABIERTO para descarga manual (Sesión: ${uniqueSessionId})`);

                return {
                    success: true,
                    data: resultado,
                    request: cpe,
                    sessionId: uniqueSessionId,
                    rucConsultante: credencialesCompletas.ruc
                };

            } catch (error) {
                logger.error(`❌ Browser ${idx + 1} Error:`, error.message);

                // En caso de error, cerrar browser
                if (browser) {
                    try {
                        await browser.close();
                    } catch (e) { }
                }

                return {
                    success: false,
                    error: error.message,
                    request: cpe
                };
            } finally {
                browsersActivos--;
            }
        };

        // ========== PROCESAMIENTO PARALELO EN CASCADA ==========
        // Iniciar cada browser después del login del anterior
        const promesas = [];

        for (let i = 0; i < listaComprobantes.length; i++) {
            // Esperar si ya tenemos MAX_BROWSERS_SIMULTANEOS activos
            while (browsersActivos >= MAX_BROWSERS_SIMULTANEOS) {
                await new Promise(r => setTimeout(r, 1000));
            }

            browsersActivos++;
            const promesa = procesarFactura(listaComprobantes[i], i);
            promesas.push(promesa);

            // Esperar un poco para dar tiempo al login antes de iniciar el siguiente
            // Esto crea el efecto "cascada"
            if (i < listaComprobantes.length - 1) {
                await new Promise(r => setTimeout(r, 8000)); // 8 segundos entre inicios (tiempo aproximado del login)
            }
        }

        // Esperar a que todos terminen
        const results = await Promise.all(promesas);
        resultados.push(...results);

        logger.info(`🎉 Consulta masiva completada: ${resultados.length}/${listaComprobantes.length} procesados`);
        logger.info(`📊 Total browsers abiertos: ${this.activeSessions.size}`);

        return {
            success: true,
            total: listaComprobantes.length,
            procesados: resultados.length,
            resultados,
            browsersAbiertos: this.activeSessions.size
        };

    } catch (error) {
        logger.error('Error crítico en consulta masiva:', error);
        return {
            success: false,
            error: error.message,
            resultados
        };
    }
}
