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
    // loginClaveSol ahora es un wrapper que delega al flujo nativo completo
    // Se mantiene por compatibilidad pero el flujo real es _nativeFullLogin
    const session = this.getOrCreateSession(ruc);
    try {
      await this._nativeFullLogin(ruc, usuario, clave, session);
      console.log(`[SUNAT DIRECT AUTH] ✅ Sesión Clave SOL iniciada exitosamente para ${ruc}`);
      return { success: true };
    } catch (error) {
      session.cpeToken = null;
      session.manualCookies = null;
      console.error(`[SUNAT DIRECT AUTH ERROR]:`, error.message);
      throw new Error(`Fallo de Autenticación Clave SOL: ${error.message}`);
    }
  }

  /**
   * Obtiene o renueva el Bearer Token JWT para el módulo de CPE
   * Usa HTTPS nativo con manejo manual de cookies para evitar problemas con axios-cookiejar-support
   */
  async obtenerTokenCpe(ruc, usuario, clave, forceRefresh = false) {
    const session = this.getOrCreateSession(ruc);

    if (!forceRefresh && session.cpeToken && session.tokenExpiry && Date.now() < session.tokenExpiry) {
      return { success: true, token: session.cpeToken };
    }

    try {
      const token = await this._nativeFullFlow(ruc, usuario, clave);
      if (token) {
        session.cpeToken = token;
        session.tokenExpiry = Date.now() + 45 * 60 * 1000;
        return { success: true, token };
      }
      throw new Error('No se pudo extraer el token de autorización de comprobantes desde el menú SOL');
    } catch (error) {
      session.cpeToken = null;
      console.error(`[SUNAT DIRECT TOKEN ERROR]:`, error.message);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  MOTOR HTTPS NATIVO - Manejo manual de cookies sin axios-cookiejar-support
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Ejecuta una petición HTTPS nativa con manejo manual de cookies
   * @returns {{ statusCode, headers, body, finalUrl }}
   */
  _httpsRequest(url, options = {}) {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');

    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity',
          ...(options.headers || {})
        }
      };

      // Agregar cookies manuales
      if (options.cookies) {
        const cookieStr = this._buildCookieString(options.cookies, parsed.hostname);
        if (cookieStr) reqOptions.headers['Cookie'] = cookieStr;
      }

      // Agregar body para POST
      if (options.body) {
        reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
      }

      const req = lib.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
            finalUrl: url
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('HTTPS request timeout')); });
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  /**
   * Almacena cookies de un response Set-Cookie header en el store manual
   */
  _storeCookies(cookieStore, responseHeaders, hostname) {
    const setCookies = responseHeaders['set-cookie'];
    if (!setCookies) return;

    const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];
    for (const raw of cookies) {
      try {
        const nameValue = raw.split(';')[0].trim();
        const eqIdx = nameValue.indexOf('=');
        if (eqIdx < 1) continue;
        const name = nameValue.substring(0, eqIdx).trim();
        const value = nameValue.substring(eqIdx + 1).trim();

        // Determinar dominio
        const domainMatch = raw.match(/domain=\.?([^;,\s]+)/i);
        let domain = domainMatch ? domainMatch[1].toLowerCase() : hostname;
        if (domain.startsWith('.')) domain = domain.substring(1);

        if (!cookieStore[domain]) cookieStore[domain] = {};
        cookieStore[domain][name] = value;

        // También asignar al hostname original si el dominio es padre
        if (hostname.endsWith(domain) && hostname !== domain) {
          if (!cookieStore[hostname]) cookieStore[hostname] = {};
          cookieStore[hostname][name] = value;
        }
      } catch (e) { /* ignorar cookies malformadas */ }
    }
  }

  /**
   * Construye el header Cookie a partir del store para un hostname dado
   */
  _buildCookieString(cookieStore, hostname) {
    const parts = [];
    // Buscar cookies exactas para este hostname
    if (cookieStore[hostname]) {
      for (const [k, v] of Object.entries(cookieStore[hostname])) {
        parts.push(`${k}=${v}`);
      }
    }
    // Buscar cookies de dominios padre (e.g. sunat.gob.pe para e-menu.sunat.gob.pe)
    for (const domain of Object.keys(cookieStore)) {
      if (domain !== hostname && hostname.endsWith(domain)) {
        for (const [k, v] of Object.entries(cookieStore[domain])) {
          if (!parts.some(p => p.startsWith(`${k}=`))) {
            parts.push(`${k}=${v}`);
          }
        }
      }
    }
    return parts.join('; ');
  }

  /**
   * Ejecuta una petición HTTPS nativa con seguimiento automático de cookies y redirects opcionales
   */
  async _nativeRequest(url, cookieStore, options = {}) {
    const { URL } = require('url');
    const maxRedirects = options.maxRedirects ?? 0;
    let currentUrl = url;
    let redirectCount = 0;

    while (true) {
      const parsed = new URL(currentUrl);
      const res = await this._httpsRequest(currentUrl, {
        ...options,
        cookies: cookieStore
      });

      // Almacenar cookies del response
      this._storeCookies(cookieStore, res.headers, parsed.hostname);

      // ¿Es un redirect?
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectCount >= maxRedirects) {
          // Devolver la respuesta 3xx sin seguir
          return res;
        }
        // Resolver URL relativa
        let nextUrl = res.headers.location;
        if (nextUrl.startsWith('/')) {
          nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
        } else if (!nextUrl.startsWith('http')) {
          nextUrl = new URL(nextUrl, currentUrl).href;
        }
        currentUrl = nextUrl;
        redirectCount++;
        // Los redirects siempre son GET, sin body
        options = { ...options, method: 'GET', body: undefined, headers: { ...options.headers } };
        delete options.headers['Content-Type'];
        delete options.headers['Content-Length'];
        continue;
      }

      res.finalUrl = currentUrl;
      return res;
    }
  }

  /**
   * ═══ FLUJO NATIVO COMPLETO: Login Clave SOL ═══
   * Hace todo el proceso de login usando HTTPS nativo con cookies manuales
   */
  async _nativeFullLogin(ruc, usuario, clave, session) {
    const cookieStore = session.manualCookies || {};

    // ── FASE 1: Obtener formulario de login y extraer state ──
    console.log(`[FASE 1] Solicitando formulario login SOL para RUC: ${ruc}...`);
    const loginUrl = 'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm';

    const loginPageRes = await this._nativeRequest(loginUrl, cookieStore, {
      maxRedirects: 3,
      headers: { 'Referer': 'https://www.sunat.gob.pe/' }
    });

    console.log(`[FASE 1] ✅ Status: ${loginPageRes.statusCode}, Body length: ${loginPageRes.body.length}, URL final: ${loginPageRes.finalUrl?.substring(0, 80)}`);

    // Extraer state del HTML o URL
    const stateMatch = (loginPageRes.finalUrl || '').match(/state=([^&]+)/) ||
                       loginPageRes.body.match(/name="state"\s+value="([^"]+)"/i) ||
                       loginPageRes.body.match(/id="state"\s+value="([^"]+)"/i);
    const state = stateMatch ? decodeURIComponent(stateMatch[1]) : '';
    console.log(`[FASE 1] State encontrado: ${state ? 'Sí (' + state.substring(0, 30) + '...)' : 'No (vacío)'}`);

    // ── FASE 2: Enviar credenciales a j_security_check ──
    console.log(`[FASE 2] Enviando credenciales Clave SOL (Usuario: ${usuario.trim().toUpperCase()})...`);
    const formData = new URLSearchParams({
      tipo: '2', dni: '',
      custom_ruc: ruc.trim(),
      j_username: usuario.trim().toUpperCase(),
      j_password: clave.trim(),
      captcha: '',
      originalUrl: 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm',
      lang: 'es-PE',
      state: state
    }).toString();

    const authRes = await this._nativeRequest(
      'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/j_security_check',
      cookieStore,
      {
        method: 'POST',
        body: formData,
        maxRedirects: 0, // NO seguir redirect, capturar Location
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://api-seguridad.sunat.gob.pe',
          'Referer': loginUrl
        }
      }
    );

    const authLocation = authRes.headers.location || '';
    console.log(`[FASE 2] ✅ Status: ${authRes.statusCode}, Location: ${authLocation ? authLocation.substring(0, 100) + '...' : '(ninguna)'}`);
    console.log(`[FASE 2] Cookies almacenadas: ${JSON.stringify(Object.keys(cookieStore))}`);

    if (!authLocation || authLocation.includes('error=') || authLocation.includes('loginMenuSol')) {
      throw new Error('Credenciales Clave SOL inválidas o acceso denegado por SUNAT');
    }

    // Extraer el JWT code de la URL de redirect (lo guardamos para posible uso como token)
    const codeMatch = authLocation.match(/code=([^&]+)/);
    if (codeMatch) {
      session._loginCode = codeMatch[1];
      console.log(`[FASE 2] JWT code extraído (longitud ${codeMatch[1].length})`);
    }

    // ── FASE 3: Navegar a AutenticaMenuInternet.htm (establecer sesión en e-menu) ──
    let autenticaUrl = authLocation;
    if (autenticaUrl.startsWith('/')) {
      autenticaUrl = `https://e-menu.sunat.gob.pe${autenticaUrl}`;
    }
    console.log(`[FASE 3] Estableciendo sesión en e-menu.sunat.gob.pe...`);

    const autenticaRes = await this._nativeRequest(autenticaUrl, cookieStore, {
      maxRedirects: 5,
      headers: { 'Referer': 'https://api-seguridad.sunat.gob.pe/' }
    });

    console.log(`[FASE 3] ✅ Status: ${autenticaRes.statusCode}, URL final: ${autenticaRes.finalUrl?.substring(0, 80)}`);
    console.log(`[FASE 3] Cookies e-menu: ${this._buildCookieString(cookieStore, 'e-menu.sunat.gob.pe').substring(0, 200)}`);

    // ── FASE 4: Cargar MenuInternet.htm principal ──
    console.log(`[FASE 4] Cargando MenuInternet.htm principal...`);
    const menuRes = await this._nativeRequest(
      'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
      cookieStore,
      {
        maxRedirects: 3,
        headers: { 'Referer': autenticaUrl }
      }
    );

    console.log(`[FASE 4] ✅ Status: ${menuRes.statusCode}, Body length: ${menuRes.body.length}`);
    const menuBodyPreview = menuRes.body.substring(0, 300).replace(/\s+/g, ' ');
    console.log(`[FASE 4] Body preview: ${menuBodyPreview}`);

    // Verificar que la sesión está activa buscando indicadores en el HTML del menú
    const isMenuLoaded = menuRes.body.includes('MenuInternet') || menuRes.body.includes('pestana') || menuRes.body.includes('menu');
    console.log(`[FASE 4] ¿Menú cargado correctamente? ${isMenuLoaded ? 'SÍ' : 'NO'}`);

    // Guardar cookies en la session para uso posterior
    session.manualCookies = cookieStore;
    return cookieStore;
  }

  /**
   * ═══ FLUJO NATIVO COMPLETO: Login + Extracción de Token ═══
   * Todo el proceso end-to-end sin axios
   */
  async _nativeFullFlow(ruc, usuario, clave) {
    const session = this.getOrCreateSession(ruc);

    // Ejecutar login completo
    const cookieStore = await this._nativeFullLogin(ruc, usuario, clave, session);

    // ── FASE 5: Disparar acción del menú para obtener token CPE ──
    console.log(`[FASE 5] Solicitando token CPE desde menú (acción 11.38.1.1.1)...`);

    const actionUrls = [
      'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1',
      'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=ruteo&id=11.38.1.1.1',
      'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1'
    ];

    for (const actionUrl of actionUrls) {
      try {
        // Primero SIN seguir redirects para capturar el 302 raw
        const res302 = await this._nativeRequest(actionUrl, cookieStore, {
          maxRedirects: 0,
          headers: {
            'Referer': 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'iframe',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin'
          }
        });

        const location302 = res302.headers.location || '';
        console.log(`[FASE 5] Status: ${res302.statusCode}, Location: ${location302 ? location302.substring(0, 120) + '...' : '(vacía)'}`);
        
        if (res302.statusCode === 200) {
          const bodyPreview = res302.body.substring(0, 300).replace(/\s+/g, ' ');
          console.log(`[FASE 5] Body (200): ${bodyPreview}`);
          console.log(`[FASE 5] Cookies enviadas: ${this._buildCookieString(cookieStore, 'e-menu.sunat.gob.pe').substring(0, 200)}`);
        }

        // Buscar token en Location del 302
        let token = this._extractTokenFromUrl(location302);
        if (token) {
          console.log(`[FASE 5] ✅ Token extraído de Location header (302)`);
          return token;
        }

        // Si hay Location pero no tiene token directo, seguir el redirect
        if (location302) {
          console.log(`[FASE 5] Siguiendo redirect a: ${location302.substring(0, 120)}...`);
          const followRes = await this._nativeRequest(location302, cookieStore, {
            maxRedirects: 3,
            headers: { 'Referer': 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm' }
          });

          token = this._extractTokenFromUrl(followRes.finalUrl) || this._extractTokenFromHtml(followRes.body);
          if (token) {
            console.log(`[FASE 5] ✅ Token extraído de URL/body final después de seguir redirect`);
            return token;
          }
        }

        // Si vino 200, intentar CON seguir redirects
        if (res302.statusCode === 200) {
          const resFollow = await this._nativeRequest(actionUrl, cookieStore, {
            maxRedirects: 5,
            headers: {
              'Referer': 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm',
              'Upgrade-Insecure-Requests': '1'
            }
          });

          console.log(`[FASE 5] Con redirects - Status: ${resFollow.statusCode}, Final URL: ${resFollow.finalUrl?.substring(0, 120)}`);
          token = this._extractTokenFromUrl(resFollow.finalUrl) || this._extractTokenFromHtml(resFollow.body);
          if (token) {
            console.log(`[FASE 5] ✅ Token extraído con follow-redirects`);
            return token;
          }
        }

        // Buscar token en el body HTML
        token = this._extractTokenFromHtml(res302.body);
        if (token) {
          console.log(`[FASE 5] ✅ Token extraído del body HTML`);
          return token;
        }

      } catch (actionErr) {
        console.warn(`[FASE 5] Error con URL ${actionUrl.substring(0, 80)}: ${actionErr.message}`);
      }
    }

    // ── FASE 6 (FALLBACK): Usar el code JWT del login como token ──
    console.log(`[FASE 6] Intentando usar JWT code del login directamente como Bearer token...`);
    if (session._loginCode) {
      // Probar si el code JWT funciona directamente como Bearer token en la API CPE
      try {
        const testRes = await this._httpsRequest(
          'https://api-cpe.sunat.gob.pe/v1/contribuyente/consultacpe/comprobantes?numRuc=20609936224&codCpe=01&numSerie=E001&numCpe=1&procedencia=2',
          {
            headers: {
              'Authorization': `Bearer ${session._loginCode}`,
              'Accept': 'application/json',
              'Referer': 'https://e-factura.sunat.gob.pe/'
            }
          }
        );
        console.log(`[FASE 6] Test con code JWT - Status: ${testRes.statusCode}`);
        if (testRes.statusCode === 200 || testRes.statusCode === 404) {
          // Si no devuelve 401/403, el token es válido
          console.log(`[FASE 6] ✅ Code JWT funciona como Bearer token`);
          return session._loginCode;
        }
      } catch (testErr) {
        console.warn(`[FASE 6] Test de code JWT falló: ${testErr.message}`);
      }
    }

    // ── FASE 7 (ÚLTIMO RECURSO): Re-autenticar con axios y tough-cookie ──
    console.log(`[FASE 7] Último recurso: re-autenticación con axios-cookiejar...`);
    try {
      const token = await this._axiosFallbackGetToken(ruc, usuario, clave, session);
      if (token) {
        console.log(`[FASE 7] ✅ Token extraído via axios fallback`);
        return token;
      }
    } catch (fallErr) {
      console.warn(`[FASE 7] Axios fallback falló: ${fallErr.message}`);
    }

    return null;
  }

  /**
   * Fallback: intentar con axios wrapper (el enfoque original) por si acaso
   */
  async _axiosFallbackGetToken(ruc, usuario, clave, session) {
    const { client } = session;
    const loginUrl = 'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm';

    // Login con axios
    const initRes = await client.get(loginUrl, { headers: { 'Referer': 'https://www.sunat.gob.pe/' } });
    const respUrl = initRes.request?.res?.responseUrl || '';
    const dataStr = typeof initRes.data === 'string' ? initRes.data : '';
    const stateMatch = respUrl.match(/state=([^&]+)/) || dataStr.match(/name="state"\s+value="([^"]+)"/i);
    const state = stateMatch ? decodeURIComponent(stateMatch[1]) : '';

    const form = new URLSearchParams({
      tipo: '2', dni: '', custom_ruc: ruc.trim(),
      j_username: usuario.trim().toUpperCase(), j_password: clave.trim(),
      captcha: '', originalUrl: 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm',
      lang: 'es-PE', state
    });

    // j_security_check con follow-redirects ACTIVADOS (dejar que axios siga todo)
    const authRes = await client.post(
      'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/j_security_check',
      form.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'https://api-seguridad.sunat.gob.pe', 'Referer': loginUrl },
        maxRedirects: 10, // Seguir TODO
        validateStatus: s => s >= 200 && s < 400
      }
    );

    console.log(`[FASE 7] Axios auth - Status: ${authRes.status}, URL final: ${authRes.request?.res?.responseUrl?.substring(0, 80) || '(none)'}`);

    // Cargar menú
    await client.get('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', { maxRedirects: 3, validateStatus: s => s >= 200 && s < 400 });

    // Disparar acción del menú con follow-redirects
    const menuRes = await client.get(
      'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1',
      {
        headers: { 'Referer': 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', 'Upgrade-Insecure-Requests': '1' },
        maxRedirects: 10,
        validateStatus: s => s >= 200 && s < 400
      }
    );

    const finalUrl = menuRes.request?.res?.responseUrl || menuRes.request?.responseURL || '';
    const location = menuRes.headers?.location || '';
    const body = typeof menuRes.data === 'string' ? menuRes.data : '';

    console.log(`[FASE 7] Axios menu - Status: ${menuRes.status}, Final URL: ${finalUrl.substring(0, 120)}`);

    return this._extractTokenFromUrl(finalUrl) || this._extractTokenFromUrl(location) || this._extractTokenFromHtml(body);
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
