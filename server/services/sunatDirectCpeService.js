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
      console.log(`[SUNAT DIRECT AUTH] 1. Solicitando formulario login SOL para RUC: ${ruc}...`);
      const loginUrl = 'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm';
      
      const initRes = await client.get(loginUrl, {
        headers: {
          'Referer': 'https://www.sunat.gob.pe/',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      const respUrl = initRes.request?.res?.responseUrl || '';
      const dataStr = typeof initRes.data === 'string' ? initRes.data : '';

      const stateMatch = respUrl.match(/state=([^&]+)/) || dataStr.match(/name="state"\s+value="([^"]+)"/i) || dataStr.match(/id="state"\s+value="([^"]+)"/i);
      const state = stateMatch ? decodeURIComponent(stateMatch[1]) : '';

      console.log(`[SUNAT DIRECT AUTH] 2. Enviando credenciales Clave SOL (Usuario: ${usuario.trim().toUpperCase()})...`);
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

      // No seguir redirects automáticamente en el POST para capturar la Location exacta de autenticación
      const authRes = await client.post(
        'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/j_security_check',
        form.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://api-seguridad.sunat.gob.pe',
            'Referer': loginUrl
          },
          maxRedirects: 0,
          validateStatus: status => status >= 200 && status < 400
        }
      );

      let redirectUrl = authRes.headers['location'] || authRes.request?.res?.responseUrl || '';
      console.log(`[SUNAT DIRECT AUTH] 3. Respuesta j_security_check Status: ${authRes.status}, Location: ${redirectUrl}`);

      if (!redirectUrl && authRes.status === 200 && typeof authRes.data === 'string') {
        const metaMatch = authRes.data.match(/url=['"]?([^'"]+)['"]?/i);
        if (metaMatch) redirectUrl = metaMatch[1];
      }

      if (redirectUrl.includes('error=') || redirectUrl.includes('loginMenuSol')) {
        throw new Error('Credenciales Clave SOL inválidas (Usuario o Clave incorrectos) o acceso denegado por SUNAT');
      }

      if (!redirectUrl) {
        throw new Error('SUNAT no retornó URL de redirección tras autenticar');
      }

      // Si la URL es relativa, asegurar protocolo
      if (redirectUrl.startsWith('/')) {
        redirectUrl = `https://e-menu.sunat.gob.pe${redirectUrl}`;
      }

      // 4. Invocar AutenticaMenuInternet.htm para establecer la sesión en e-menu.sunat.gob.pe
      console.log(`[SUNAT DIRECT AUTH] 4. Estableciendo sesión en e-menu.sunat.gob.pe...`);
      const authMenuRes = await client.get(redirectUrl, {
        headers: {
          'Referer': 'https://api-seguridad.sunat.gob.pe/'
        },
        maxRedirects: 3,
        validateStatus: status => status >= 200 && status < 400
      });

      // 5. Cargar MenuInternet.htm principal
      await client.get('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', {
        headers: {
          'Referer': redirectUrl
        },
        validateStatus: status => status >= 200 && status < 400
      });

      console.log(`[SUNAT DIRECT AUTH] ✅ Sesión Clave SOL iniciada exitosamente para ${ruc}`);
      return { success: true };
    } catch (error) {
      session.cpeToken = null;
      console.error(`[SUNAT DIRECT AUTH ERROR]:`, error.message);
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
      console.log(`[SUNAT DIRECT TOKEN] Solicitando token CPE desde menú...`);

      // ─── ESTRATEGIA A: Seguir redirects y leer URL final ───
      const menuActionUrls = [
        'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1',
        'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=ruteo&id=11.38.1.1.1',
        'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1'
      ];

      for (const actionUrl of menuActionUrls) {
        try {
          // Intentar con redirect seguido automáticamente
          const res = await session.client.get(actionUrl, {
            headers: {
              'Referer': 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
              'Upgrade-Insecure-Requests': '1',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Sec-Fetch-Dest': 'iframe',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'same-origin'
            },
            maxRedirects: 5,
            validateStatus: status => status >= 200 && status < 400
          });

          // Extraer URL final del response (después de todos los redirects)
          const finalUrl = res.request?.res?.responseUrl || res.request?.responseURL || '';
          const resHeaders = res.headers || {};
          const locationHeader = resHeaders['location'] || resHeaders['Location'] || '';
          const bodyHtml = typeof res.data === 'string' ? res.data : '';

          console.log(`[SUNAT DIRECT TOKEN] Status: ${res.status}, Final URL: ${finalUrl ? finalUrl.substring(0, 120) + '...' : '(none)'}`);
          console.log(`[SUNAT DIRECT TOKEN] Location header: ${locationHeader ? locationHeader.substring(0, 120) + '...' : '(none)'}`);

          // Buscar token en la URL final (donde llegó después de seguir redirects)
          let token = this._extractTokenFromUrl(finalUrl);
          if (token) {
            session.cpeToken = token;
            session.tokenExpiry = Date.now() + 45 * 60 * 1000;
            console.log(`[SUNAT DIRECT TOKEN] ✅ Token extraído de URL final (follow-redirect)`);
            return { success: true, token };
          }

          // Buscar token en Location header (por si no se siguió)
          token = this._extractTokenFromUrl(locationHeader);
          if (token) {
            session.cpeToken = token;
            session.tokenExpiry = Date.now() + 45 * 60 * 1000;
            console.log(`[SUNAT DIRECT TOKEN] ✅ Token extraído de Location header`);
            return { success: true, token };
          }

          // Buscar token en el body HTML
          token = this._extractTokenFromHtml(bodyHtml);
          if (token) {
            session.cpeToken = token;
            session.tokenExpiry = Date.now() + 45 * 60 * 1000;
            console.log(`[SUNAT DIRECT TOKEN] ✅ Token extraído de HTML body`);
            return { success: true, token };
          }

        } catch (axiosErr) {
          // Si axios lanzó error por redirect (302), capturar la Location del error
          if (axiosErr.response) {
            const errLocation = axiosErr.response.headers?.['location'] || '';
            console.log(`[SUNAT DIRECT TOKEN] Error ${axiosErr.response.status}, Location en error: ${errLocation ? errLocation.substring(0, 120) + '...' : '(none)'}`);
            const token = this._extractTokenFromUrl(errLocation);
            if (token) {
              session.cpeToken = token;
              session.tokenExpiry = Date.now() + 45 * 60 * 1000;
              console.log(`[SUNAT DIRECT TOKEN] ✅ Token extraído de error-response Location`);
              return { success: true, token };
            }
          }
          console.warn(`[SUNAT DIRECT TOKEN] Intento A con ${actionUrl.substring(0, 80)} falló:`, axiosErr.message);
        }
      }

      // ─── ESTRATEGIA B: HTTP nativo para capturar 302 raw ───
      console.log(`[SUNAT DIRECT TOKEN] Intentando Estrategia B: HTTP nativo...`);
      try {
        const rawToken = await this._httpNativeGetToken(session);
        if (rawToken) {
          session.cpeToken = rawToken;
          session.tokenExpiry = Date.now() + 45 * 60 * 1000;
          console.log(`[SUNAT DIRECT TOKEN] ✅ Token extraído via HTTP nativo`);
          return { success: true, token: rawToken };
        }
      } catch (nativeErr) {
        console.warn(`[SUNAT DIRECT TOKEN] Estrategia B falló:`, nativeErr.message);
      }

      // ─── ESTRATEGIA C: Extraer token del JWT code en la URL de login ───
      console.log(`[SUNAT DIRECT TOKEN] Intentando Estrategia C: Re-login y extraer del code JWT...`);
      try {
        const codeToken = await this._extractTokenFromLoginCode(ruc, usuario, clave, session);
        if (codeToken) {
          session.cpeToken = codeToken;
          session.tokenExpiry = Date.now() + 45 * 60 * 1000;
          console.log(`[SUNAT DIRECT TOKEN] ✅ Token extraído del code JWT de login`);
          return { success: true, token: codeToken };
        }
      } catch (codeErr) {
        console.warn(`[SUNAT DIRECT TOKEN] Estrategia C falló:`, codeErr.message);
      }

      throw new Error('No se pudo extraer el token de autorización de comprobantes desde el menú SOL');
    } catch (error) {
      session.cpeToken = null;
      console.error(`[SUNAT DIRECT TOKEN ERROR]:`, error.message);
      throw error;
    }
  }

  /**
   * Extrae el token de una URL que contenga ?token=eyJ... o &token=eyJ...
   */
  _extractTokenFromUrl(url) {
    if (!url) return null;
    const match = url.match(/[?&]token=([^&"'\s<>]+)/);
    if (match && match[1] && match[1].length > 50) return match[1];
    return null;
  }

  /**
   * Extrae el token de un body HTML buscando parámetros token, JWT patterns, etc.
   */
  _extractTokenFromHtml(html) {
    if (!html) return null;
    const patterns = [
      /token\s*[:=]\s*["']([^"']{50,})["']/i,
      /[?&]token=([a-zA-Z0-9_\-\.]{50,})/i,
      /token["']\s*:\s*["'](eyJ[a-zA-Z0-9_\-\.]{50,})["']/i,
      /(eyJ[a-zA-Z0-9_\-]{30,}\.[a-zA-Z0-9_\-]{30,}\.[a-zA-Z0-9_\-]{30,})/
    ];
    for (const pat of patterns) {
      const m = html.match(pat);
      if (m && m[1]) return m[1];
    }
    return null;
  }

  /**
   * Estrategia B: usa http/https nativo de Node.js para capturar el header Location
   * sin que axios-cookiejar-support interfiera
   */
  async _httpNativeGetToken(session) {
    const https = require('https');
    const { URL } = require('url');

    // Obtener cookies del jar para el dominio e-menu
    const cookieStr = await session.jar.getCookieString('https://e-menu.sunat.gob.pe');
    const actionUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
    const parsed = new URL(actionUrl);

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Upgrade-Insecure-Requests': '1'
        }
      }, (res) => {
        const location = res.headers['location'] || '';
        console.log(`[SUNAT DIRECT TOKEN] HTTP nativo Status: ${res.statusCode}, Location: ${location ? location.substring(0, 120) + '...' : '(none)'}`);

        const token = this._extractTokenFromUrl(location);
        if (token) {
          resolve(token);
        } else if (res.statusCode >= 300 && res.statusCode < 400 && location) {
          // Seguir el redirect manualmente y buscar en la URL/body final
          const followReq = https.get(location, {
            headers: {
              'Cookie': cookieStr,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://e-menu.sunat.gob.pe/'
            }
          }, (followRes) => {
            let body = '';
            followRes.on('data', (chunk) => body += chunk);
            followRes.on('end', () => {
              const fToken = this._extractTokenFromUrl(followRes.headers['location'] || '') ||
                             this._extractTokenFromHtml(body);
              resolve(fToken || null);
            });
          });
          followReq.on('error', () => resolve(null));
        } else {
          // Leer body de respuesta 200 y buscar token
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            const fToken = this._extractTokenFromHtml(body);
            resolve(fToken || null);
          });
        }
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout HTTP nativo')); });
      req.end();
    });
  }

  /**
   * Estrategia C: El JWT code del login ya contiene un token que podría ser
   * reutilizable para la API CPE. Lo extraemos del redirect de j_security_check.
   */
  async _extractTokenFromLoginCode(ruc, usuario, clave, session) {
    // Re-iniciar login para capturar el code
    const loginUrl = 'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm';

    const initRes = await session.client.get(loginUrl, {
      headers: { 'Referer': 'https://www.sunat.gob.pe/' }
    });
    const respUrl = initRes.request?.res?.responseUrl || '';
    const dataStr = typeof initRes.data === 'string' ? initRes.data : '';
    const stateMatch = respUrl.match(/state=([^&]+)/) || dataStr.match(/name="state"\s+value="([^"]+)"/i);
    const state = stateMatch ? decodeURIComponent(stateMatch[1]) : '';

    const form = new URLSearchParams({
      tipo: '2', dni: '',
      custom_ruc: ruc.trim(),
      j_username: usuario.trim().toUpperCase(),
      j_password: clave.trim(),
      captcha: '',
      originalUrl: 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm',
      lang: 'es-PE', state
    });

    const authRes = await session.client.post(
      'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/j_security_check',
      form.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://api-seguridad.sunat.gob.pe',
          'Referer': loginUrl
        },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      }
    );

    const redirectUrl = authRes.headers['location'] || '';
    // El code= en la URL es un JWT que contiene el token de acceso
    const codeMatch = redirectUrl.match(/code=([^&]+)/);
    if (codeMatch && codeMatch[1]) {
      // Este code JWT es el mismo token que SUNAT usa internamente
      console.log(`[SUNAT DIRECT TOKEN] Code JWT encontrado (longitud ${codeMatch[1].length})`);
      // Primero, intentemos navegar a la acción del menú tras el re-login
      await session.client.get(redirectUrl, { maxRedirects: 3, validateStatus: s => s >= 200 && s < 400 });
      await session.client.get('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', { maxRedirects: 2, validateStatus: s => s >= 200 && s < 400 });

      // Intentar acción del menú una vez más
      const menuRes = await session.client.get(
        'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1',
        {
          headers: {
            'Referer': 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
            'Upgrade-Insecure-Requests': '1'
          },
          maxRedirects: 5,
          validateStatus: s => s >= 200 && s < 400
        }
      );

      const menuFinalUrl = menuRes.request?.res?.responseUrl || menuRes.request?.responseURL || '';
      const menuLocation = menuRes.headers['location'] || '';
      const menuBody = typeof menuRes.data === 'string' ? menuRes.data : '';

      console.log(`[SUNAT DIRECT TOKEN] Post re-login menu Final URL: ${menuFinalUrl ? menuFinalUrl.substring(0, 120) : '(none)'}`);

      let token = this._extractTokenFromUrl(menuFinalUrl) ||
                  this._extractTokenFromUrl(menuLocation) ||
                  this._extractTokenFromHtml(menuBody);

      if (token) return token;
    }

    return null;
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
