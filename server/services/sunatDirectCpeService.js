const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

/**
 * Servicio de Consulta Directa de CPE (SUNAT) mediante Ingeniería Inversa HTTP
 * No requiere Chromium / Playwright. Tiempo de respuesta: <300ms por comprobante.
 */
class SunatDirectCpeService {
  constructor() {
    // Cache de sesiones y clientes HTTP por RUC
    // key: ruc, value: { client, jar, cpeToken, tokenExpiry, lastUsed }
    this.sessions = new Map();
  }

  /**
   * Obtiene o crea un cliente HTTP con CookieJar aislado para la empresa
   */
  getOrCreateSession(ruc) {
    const existing = this.sessions.get(ruc);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing;
    }

    const jar = new CookieJar();
    const client = wrapper(axios.create({
      jar,
      withCredentials: true,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
      }
    }));

    const session = {
      client,
      jar,
      cpeToken: null,
      tokenExpiry: null,
      lastUsed: Date.now()
    };

    this.sessions.set(ruc, session);
    return session;
  }

  /**
   * Inicia sesión en SUNAT SOL y persiste cookies en el CookieJar
   */
  async loginClaveSol(ruc, usuario, clave) {
    const session = this.getOrCreateSession(ruc);
    const { client } = session;

    try {
      const loginUrl = 'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm';
      
      const initRes = await client.get(loginUrl);
      const respUrl = initRes.request?.res?.responseUrl || '';
      const dataStr = typeof initRes.data === 'string' ? initRes.data : '';

      const stateMatch = respUrl.match(/state=([^&]+)/) || dataStr.match(/name="state" value="([^"]+)"/);
      const state = stateMatch ? decodeURIComponent(stateMatch[1]) : '';

      const form = new URLSearchParams({
        tipo: '2',
        dni: '',
        custom_ruc: ruc.trim(),
        j_username: usuario.trim().toUpperCase(),
        j_password: clave.trim(),
        captcha: '',
        originalUrl: 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm',
        lang: 'es-PE',
        state: state
      });

      const authRes = await client.post(
        'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/j_security_check',
        form.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 5
        }
      );

      // Verificar si hubo error de autenticación en la URL de retorno
      const finalUrl = authRes.request?.res?.responseUrl || '';
      if (finalUrl.includes('error=') || finalUrl.includes('loginMenuSol')) {
        throw new Error('Credenciales Clave SOL inválidas o acceso denegado por SUNAT');
      }

      return { success: true };
    } catch (error) {
      session.cpeToken = null;
      throw new Error(`Fallo de Autenticación Clave SOL: ${error.message}`);
    }
  }

  /**
   * Obtiene o renueva el Bearer Token JWT para el módulo de CPE
   */
  async obtenerTokenCpe(ruc, usuario, clave, forceRefresh = false) {
    const session = this.getOrCreateSession(ruc);

    if (!forceRefresh && session.cpeToken && session.tokenExpiry && Date.now() < session.tokenExpiry) {
      return { success: true, token: session.cpeToken };
    }

    try {
      // 1. Asegurar sesión iniciada
      await this.loginClaveSol(ruc, usuario, clave);

      // 2. Disparar acción del menú para generar el token CPE
      const menuActionUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
      
      const res = await session.client.get(menuActionUrl, {
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      });

      const location = res.headers['location'] || res.request?.res?.responseUrl || '';
      const tokenMatch = location.match(/token=([^&]+)/);

      if (tokenMatch && tokenMatch[1]) {
        session.cpeToken = tokenMatch[1];
        // Los tokens de SUNAT suelen durar 1 a 2 horas; establecemos expiración en 45 min por seguridad
        session.tokenExpiry = Date.now() + 45 * 60 * 1000;
        return { success: true, token: session.cpeToken };
      }

      // Si no vino en el Location directo, buscar si se redirigió a nuevaconsulta.html
      const pageRes = await session.client.get(location || menuActionUrl, { maxRedirects: 3 });
      const finalUrl = pageRes.request?.res?.responseUrl || '';
      const subTokenMatch = finalUrl.match(/token=([^&]+)/);

      if (subTokenMatch && subTokenMatch[1]) {
        session.cpeToken = subTokenMatch[1];
        session.tokenExpiry = Date.now() + 45 * 60 * 1000;
        return { success: true, token: session.cpeToken };
      }

      throw new Error('No se pudo extraer el token de autorización de comprobantes');
    } catch (error) {
      session.cpeToken = null;
      throw error;
    }
  }

  /**
   * Normaliza los datos de respuesta de SUNAT a un objeto estándar
   */
  normalizarRespuestaCpe(item) {
    if (!item) return null;

    const datosEmisor = item.datosEmisor || {};
    const datosReceptor = item.datosReceptor || {};
    const procedencia = item.procedenciaIndivual || {};

    const rawEstado = String(item.indEstadoCpe ?? '').trim();
    let estado = 'DESCONOCIDO';
    if (rawEstado === '0' || rawEstado === '1') estado = 'ACEPTADO';
    else if (rawEstado === '2') estado = 'ANULADO';
    else if (rawEstado === '3') estado = 'AUTORIZADO';
    else if (rawEstado === '4') estado = 'NO_AUTORIZADO';
    else estado = rawEstado ? `ESTADO_${rawEstado}` : 'ACEPTADO';

    return {
      rucEmisor: datosEmisor.numRuc || '',
      razonSocialEmisor: datosEmisor.desRazonSocialEmis || datosEmisor.desNomComercialEmis || '',
      direccionEmisor: datosEmisor.desDirEmis || '',
      ubigeoEmisor: datosEmisor.ubigeoEmis || '',
      docReceptorTipo: datosReceptor.codDocIdeRecep || '6',
      docReceptorNum: datosReceptor.numDocIdeRecep || '',
      razonSocialReceptor: datosReceptor.desRazonSocialRecep || '',
      direccionReceptor: datosReceptor.dirDetCliente || '',
      tipoCpe: String(item.codCpe || '01').padStart(2, '0'),
      serie: (item.numSerie || '').toUpperCase(),
      numero: String(item.numCpe || ''),
      moneda: item.codMoneda || 'PEN',
      fechaEmision: item.fecEmision || '',
      fechaRegistro: item.fecRegistro || '',
      estado: estado,
      indEstadoCpe: rawEstado,
      montoGravado: Number(procedencia.mtoOpGravado || procedencia.mtoSubTotal || 0),
      montoExonerado: Number(procedencia.mtoOpExonerado || 0),
      montoInafecto: Number(procedencia.mtoOpInafecto || 0),
      montoIgv: Number(procedencia.mtoIGV || 0),
      montoIsc: Number(procedencia.mtoISC || 0),
      montoIcbper: Number(procedencia.mtoICBPER || 0),
      montoOtrosTributos: Number(procedencia.mtoOtrosTributos || 0),
      montoTotal: Number(procedencia.mtoImporteTotal || item.mtoImpTotal || 0),
      desMontoLetras: item.desMtoTotalLetras || '',
      items: (item.informacionItems || []).map(it => ({
        cantidad: Number(it.cntItems || 1),
        unidadMedida: it.codUnidadMedida || 'NIU',
        descripcionUnidad: it.desUnidadMedida || '',
        codigo: it.desCodigo || '',
        descripcion: it.desItem || '',
        valorUnitario: Number(it.mtoValUnitario || 0),
        montoTotal: Number(it.mtoImpTotal || 0)
      })),
      rawResponse: item
    };
  }

  /**
   * Consulta individual de un comprobante electrónico en SUNAT
   */
  async consultarComprobante({ rucEmpresa, usuarioSol, claveSol, rucEmisor, tipoCpe, serie, correlativo, procedencia = '2' }) {
    const rucLimpiado = String(rucEmisor || '').trim();
    const tipoNormalizado = String(tipoCpe || '01').trim().padStart(2, '0');
    const serieLimpiada = String(serie || '').trim().toUpperCase();
    const correlativoLimpiado = parseInt(String(correlativo || '0').replace(/\D/g, ''), 10);

    if (!rucLimpiado || !serieLimpiada || !correlativoLimpiado) {
      throw new Error('RUC Emisor, Serie y Número de comprobante son obligatorios');
    }

    let tokenInfo = await this.obtenerTokenCpe(rucEmpresa, usuarioSol, claveSol);
    const session = this.getOrCreateSession(rucEmpresa);

    const executeRequest = async (token) => {
      const endpoint = `https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe/comprobantes/${rucLimpiado}-${tipoNormalizado}-${serieLimpiada}-${correlativoLimpiado}-${procedencia}`;
      
      return await session.client.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://e-factura.sunat.gob.pe',
          'Referer': 'https://e-factura.sunat.gob.pe/'
        }
      });
    };

    try {
      let res;
      try {
        res = await executeRequest(tokenInfo.token);
      } catch (err) {
        // Si el token expiró (401 o 403), re-autenticamos una vez
        if (err.response?.status === 401 || err.response?.status === 403) {
          tokenInfo = await this.obtenerTokenCpe(rucEmpresa, usuarioSol, claveSol, true);
          res = await executeRequest(tokenInfo.token);
        } else {
          throw err;
        }
      }

      if (res.data && Array.isArray(res.data.comprobantes) && res.data.comprobantes.length > 0) {
        const item = res.data.comprobantes[0];
        const normalizado = this.normalizarRespuestaCpe(item);
        return {
          success: true,
          encontrado: true,
          data: normalizado
        };
      }

      return {
        success: true,
        encontrado: false,
        mensaje: 'Comprobante no existe en los registros de SUNAT o no corresponde a los parámetros indicados.'
      };
    } catch (error) {
      return {
        success: false,
        encontrado: false,
        error: error.response?.data?.message || error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Descarga el archivo XML original (empaquetado en ZIP en base64) de SUNAT
   * Endpoint: /comprobantes/{ruc}-{tipo}-{serie}-{correlativo}-{procedencia}/02
   */
  async descargarXmlComprobante({ rucEmpresa, usuarioSol, claveSol, rucEmisor, tipoCpe, serie, correlativo, procedencia = '2', codOpcion = '02' }) {
    const rucLimpiado = String(rucEmisor || '').trim();
    const tipoNormalizado = String(tipoCpe || '01').trim().padStart(2, '0');
    const serieLimpiada = String(serie || '').trim().toUpperCase();
    const correlativoLimpiado = parseInt(String(correlativo || '0').replace(/\D/g, ''), 10);

    let tokenInfo = await this.obtenerTokenCpe(rucEmpresa, usuarioSol, claveSol);
    const session = this.getOrCreateSession(rucEmpresa);

    const executeRequest = async (token) => {
      const endpoint = `https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe/comprobantes/${rucLimpiado}-${tipoNormalizado}-${serieLimpiada}-${correlativoLimpiado}-${procedencia}/${codOpcion}`;
      
      return await session.client.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://e-factura.sunat.gob.pe',
          'Referer': 'https://e-factura.sunat.gob.pe/'
        }
      });
    };

    try {
      let res;
      try {
        res = await executeRequest(tokenInfo.token);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          tokenInfo = await this.obtenerTokenCpe(rucEmpresa, usuarioSol, claveSol, true);
          res = await executeRequest(tokenInfo.token);
        } else {
          throw err;
        }
      }

      if (res.data && res.data.valArchivo) {
        const nomArchivo = res.data.nomArchivo || `${rucLimpiado}-${tipoNormalizado}-${serieLimpiada}-${correlativoLimpiado}.zip`;
        const zipBase64 = res.data.valArchivo;
        let xmlContent = '';
        let xmlFileName = nomArchivo.replace(/\.zip$/i, '.xml');

        // Extraer el XML del ZIP si adm-zip está disponible
        try {
          const AdmZip = require('adm-zip');
          const zipBuffer = Buffer.from(zipBase64, 'base64');
          const zip = new AdmZip(zipBuffer);
          const zipEntries = zip.getEntries();
          const xmlEntry = zipEntries.find(entry => entry.entryName.toLowerCase().endsWith('.xml'));

          if (xmlEntry) {
            xmlFileName = xmlEntry.entryName;
            xmlContent = xmlEntry.getData().toString('utf8');
          }
        } catch (zipErr) {
          console.warn('[CPE XML UNZIP] No se pudo descomprimir XML en memoria:', zipErr.message);
        }

        return {
          success: true,
          nomArchivo,
          zipBase64,
          xmlFileName,
          xmlContent,
          xmlBase64: xmlContent ? Buffer.from(xmlContent, 'utf8').toString('base64') : null
        };
      }

      return {
        success: false,
        error: 'SUNAT no retornó el archivo ZIP/XML del comprobante'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Consulta masiva de comprobantes con concurrencia controlada (pool)
   */
  async consultarLoteMasivo({ rucEmpresa, usuarioSol, claveSol, listaComprobantes, concurrencia = 4 }) {
    if (!Array.isArray(listaComprobantes) || listaComprobantes.length === 0) {
      throw new Error('La lista de comprobantes a consultar está vacía');
    }

    // 1. Asegurar sesión y token antes de iniciar el lote
    await this.obtenerTokenCpe(rucEmpresa, usuarioSol, claveSol);

    const resultados = [];
    const queue = [...listaComprobantes.map((item, index) => ({ item, index }))];
    const total = queue.length;

    // Resumen estadístico
    const stats = {
      total: total,
      procesados: 0,
      aceptados: 0,
      anulados: 0,
      noEncontrados: 0,
      errores: 0,
      montoTotalGravado: 0,
      montoTotalIgv: 0,
      montoTotalGeneral: 0
    };

    const worker = async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (!task) break;

        const { item, index } = task;
        try {
          const res = await this.consultarComprobante({
            rucEmpresa,
            usuarioSol,
            claveSol,
            rucEmisor: item.rucEmisor || item.ruc || item.doc_num,
            tipoCpe: item.tipoCpe || item.tipo || item.tipo_doc || '01',
            serie: item.serie,
            correlativo: item.numero || item.correlativo || item.numCpe,
            procedencia: item.procedencia || '2'
          });

          if (res.success && res.encontrado && res.data) {
            const d = res.data;
            if (d.estado === 'ACEPTADO') stats.aceptados++;
            else if (d.estado === 'ANULADO') stats.anulados++;
            else stats.aceptados++;

            stats.montoTotalGravado += d.montoGravado || 0;
            stats.montoTotalIgv += d.montoIgv || 0;
            stats.montoTotalGeneral += d.montoTotal || 0;

            resultados[index] = {
              index,
              itemOriginal: item,
              success: true,
              encontrado: true,
              resultado: d
            };
          } else if (res.success && !res.encontrado) {
            stats.noEncontrados++;
            resultados[index] = {
              index,
              itemOriginal: item,
              success: true,
              encontrado: false,
              estado: 'NO_EXISTE',
              mensaje: res.mensaje || 'Comprobante no existe en SUNAT'
            };
          } else {
            stats.errores++;
            resultados[index] = {
              index,
              itemOriginal: item,
              success: false,
              encontrado: false,
              estado: 'ERROR',
              error: res.error || 'Error al consultar comprobante'
            };
          }
        } catch (err) {
          stats.errores++;
          resultados[index] = {
            index,
            itemOriginal: item,
            success: false,
            encontrado: false,
            estado: 'ERROR',
            error: err.message
          };
        } finally {
          stats.procesados++;
        }
      }
    };

    // Ejecutar workers concurrentes
    const workers = [];
    const activeWorkers = Math.min(concurrencia, total);
    for (let i = 0; i < activeWorkers; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    return {
      success: true,
      stats,
      resultados
    };
  }
}

module.exports = new SunatDirectCpeService();
