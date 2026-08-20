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
   * Reutiliza el mismo token durante 45 minutos para todas las consultas y descargas masivas.
   * Cuenta con Mutex (Promise Lock) para evitar múltiples logins simultáneos.
   */
  async obtenerTokenCpe(ruc, usuario, clave, forceRefresh = false) {
    const session = this.getOrCreateSession(ruc);

    // 1. Si ya tenemos un token vigente y no se forzó el refresco, reutilizarlo de inmediato
    if (!forceRefresh && session.cpeToken && session.tokenExpiry && Date.now() < session.tokenExpiry) {
      const minRestantes = Math.round((session.tokenExpiry - Date.now()) / 60000);
      return { success: true, token: session.cpeToken, cached: true, minRestantes };
    }

    // 2. Si ya hay un login en progreso, esperar a que termine para reutilizar el mismo resultado
    if (session._tokenPromise) {
      try {
        const token = await session._tokenPromise;
        if (token) return { success: true, token, cached: true };
      } catch (e) {
        // Si falló la promesa previa, continuar para intentar de nuevo
      }
    }

    // 3. Crear el Mutex / Promise Lock para este RUC
    session._tokenPromise = (async () => {
      try {
        console.log(`[SUNAT AUTH] 🔑 Generando nuevo Bearer Token para RUC ${ruc}...`);
        const token = await this._nativeFullFlow(ruc, usuario, clave);
        if (token) {
          session.cpeToken = token;
          session.tokenExpiry = Date.now() + 45 * 60 * 1000; // 45 minutos de vigencia
          console.log(`[SUNAT AUTH] ✅ Bearer Token obtenido y almacenado en caché por 45 minutos`);
          return token;
        }
        throw new Error('No se pudo extraer el token de autorización de comprobantes desde el menú SOL');
      } finally {
        session._tokenPromise = null;
      }
    })();

    try {
      const token = await session._tokenPromise;
      return { success: true, token };
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
          'Host': parsed.hostname,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive',
          ...(options.headers || {})
        }
      };

      // Agregar cookies manuales (unificadas para todo el dominio SUNAT)
      if (options.cookies) {
        const cookieStr = this._buildCookieString(options.cookies);
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
   * Almacena cookies de un response Set-Cookie header en el store plano unificado
   */
  _storeCookies(cookieStore, responseHeaders) {
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

        // Almacenar globalmente para todas las peticiones a SUNAT
        cookieStore[name] = value;
      } catch (e) { /* ignorar */ }
    }
  }

  /**
   * Construye el header Cookie a partir del store plano unificado
   */
  _buildCookieString(cookieStore) {
    const parts = [];
    for (const [k, v] of Object.entries(cookieStore)) {
      if (k && v !== undefined && v !== null) {
        parts.push(`${k}=${v}`);
      }
    }
    return parts.join('; ');
  }

  /**
   * Ejecuta una petición HTTPS nativa con almacenamiento automático de cookies y redirects opcionales
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

      // Almacenar cookies del response inmediatamente
      this._storeCookies(cookieStore, res.headers);

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
   * Inicia el flujo OAuth2 legítimo desde MenuInternet.htm para obtener el state real
   */
  async _nativeFullLogin(ruc, usuario, clave, session) {
    const userSolKey = `${ruc.trim()}${usuario.trim().toUpperCase()}`;
    const cookieStore = session.manualCookies || {};

    // Pre-establecer cookies requeridas de usuario y balanceador
    cookieStore[userSolKey] = '1';
    cookieStore['f5_cspm'] = '1234';

    // ── FASE 1: Obtener el state legítimo desde MenuInternet.htm ──
    console.log(`[FASE 1] Solicitando MenuInternet.htm para generar state OAuth...`);
    const initialMenuRes = await this._nativeRequest('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', cookieStore, {
      maxRedirects: 0,
      headers: {
        'Referer': 'https://www.sunat.gob.pe/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // Extraer URL de redirect de OAuth y state generado por e-menu
    const redirectMatch = initialMenuRes.body.match(/redirect\(["']([^"']+)["']\)/i);
    let oauthUrl = redirectMatch ? redirectMatch[1] : '';
    let state = '';
    if (oauthUrl) {
      const stateMatch = oauthUrl.match(/state=([^&]+)/);
      if (stateMatch) state = decodeURIComponent(stateMatch[1]);
    }
    console.log(`[FASE 1] ✅ OAuth URL obtenida: ${oauthUrl ? 'SÍ' : 'NO'}, State length: ${state.length}`);

    // Si no se encontró en el JS, usar URL por defecto
    if (!oauthUrl) {
      oauthUrl = 'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm';
    }

    // ── FASE 2: Navegar a la URL de login OAuth para obtener cookies de api-seguridad ──
    console.log(`[FASE 2] Inicializando login OAuth en api-seguridad...`);
    const loginPageRes = await this._nativeRequest(oauthUrl, cookieStore, {
      maxRedirects: 3,
      headers: { 
        'Referer': 'https://e-menu.sunat.gob.pe/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site'
      }
    });
    console.log(`[FASE 2] ✅ Status: ${loginPageRes.statusCode}, Final URL: ${loginPageRes.finalUrl?.substring(0, 80)}`);

    // Si no teníamos state antes, buscarlo en loginPageRes
    if (!state) {
      const stateMatch = (loginPageRes.finalUrl || '').match(/state=([^&]+)/) ||
                         loginPageRes.body.match(/name="state"\s+value="([^"]+)"/i);
      if (stateMatch) state = decodeURIComponent(stateMatch[1]);
    }
    console.log(`[FASE 2] State para j_security_check: ${state ? 'OK (' + state.substring(0, 30) + '...)' : 'vacío'}`);

    // ── FASE 3: Enviar credenciales a j_security_check con el state legítimo ──
    console.log(`[FASE 3] Enviando credenciales Clave SOL (Usuario: ${usuario.trim().toUpperCase()})...`);
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
          'Referer': oauthUrl,
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin'
        }
      }
    );

    const authLocation = authRes.headers.location || '';
    console.log(`[FASE 3] ✅ Status: ${authRes.statusCode}, Location: ${authLocation ? authLocation.substring(0, 100) + '...' : '(ninguna)'}`);

    if (!authLocation || authLocation.includes('error=') || authLocation.includes('loginMenuSol')) {
      throw new Error('Credenciales Clave SOL inválidas o acceso denegado por SUNAT');
    }

    // Extraer el JWT code de la URL de redirect
    const codeMatch = authLocation.match(/code=([^&]+)/);
    if (codeMatch) {
      session._loginCode = codeMatch[1];
      console.log(`[FASE 3] JWT code extraído (longitud ${codeMatch[1].length})`);
    }

    // ── FASE 4: Establecer sesión en AutenticaMenuInternet.htm con state + code ──
    let autenticaUrl = authLocation;
    if (autenticaUrl.startsWith('/')) {
      autenticaUrl = `https://e-menu.sunat.gob.pe${autenticaUrl}`;
    }
    console.log(`[FASE 4] Invocando AutenticaMenuInternet.htm con token y state...`);

    const autenticaRes = await this._nativeRequest(autenticaUrl, cookieStore, {
      maxRedirects: 0,
      headers: {
        'Referer': 'https://api-seguridad.sunat.gob.pe/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const autenticaLocation = autenticaRes.headers.location || '';
    console.log(`[FASE 4] ✅ Autentica Status: ${autenticaRes.statusCode}, Location: ${autenticaLocation ? autenticaLocation.substring(0, 100) : '(ninguna)'}`);
    console.log(`[FASE 4] Cookies en store tras Autentica: ${Object.keys(cookieStore).join(', ')}`);

    // ── FASE 5: Cargar MenuInternet.htm autenticado ──
    let menuUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?pestana=*&agrupacion=*';
    if (autenticaLocation) {
      if (autenticaLocation.startsWith('http')) menuUrl = autenticaLocation;
      else if (autenticaLocation.startsWith('/')) menuUrl = `https://e-menu.sunat.gob.pe${autenticaLocation}`;
      else menuUrl = `https://e-menu.sunat.gob.pe/cl-ti-itmenu/${autenticaLocation}`;
    }

    console.log(`[FASE 5] Cargando MenuInternet.htm autenticado (${menuUrl.substring(0, 80)})...`);
    const menuRes = await this._nativeRequest(
      menuUrl,
      cookieStore,
      {
        maxRedirects: 3,
        headers: {
          'Referer': autenticaUrl,
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Upgrade-Insecure-Requests': '1'
        }
      }
    );

    console.log(`[FASE 5] ✅ Status: ${menuRes.statusCode}, Body length: ${menuRes.body.length}`);
    const isMenuLoaded = menuRes.body.includes('MenuInternet') || menuRes.body.includes('pestana') || menuRes.body.includes('Comprobantes');
    console.log(`[FASE 5] ¿Menú cargado correctamente? ${isMenuLoaded ? 'SÍ' : 'NO'}`);

    // Guardar cookies en la session para uso posterior
    session.manualCookies = cookieStore;
    session.menuUrl = menuUrl;
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
    const menuReferer = session.menuUrl || 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?pestana=*&agrupacion=*';

    // ── FASE 6: Disparar acción del menú para obtener token CPE ──
    console.log(`[FASE 6] Solicitando token CPE desde menú (acción 11.38.1.1.1)...`);

    const actionUrls = [
      'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1',
      'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=ruteo&id=11.38.1.1.1',
      'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1'
    ];

    for (const actionUrl of actionUrls) {
      try {
        // Enviar con headers idénticos al iframe del navegador
        const res302 = await this._nativeRequest(actionUrl, cookieStore, {
          maxRedirects: 0,
          headers: {
            'Referer': menuReferer,
            'Sec-Fetch-Dest': 'iframe',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        const location302 = res302.headers.location || '';
        console.log(`[FASE 6] Status: ${res302.statusCode}, Location: ${location302 ? location302.substring(0, 120) + '...' : '(vacía)'}`);

        // 1. Buscar token directamente en Location del 302
        let token = this._extractTokenFromUrl(location302);
        if (token) {
          console.log(`[FASE 6] ✅ Token CPE extraído exitosamente de Location header (302)`);
          return token;
        }

        // 2. Si hay Location pero no tiene token explícito, seguir el redirect
        if (location302) {
          console.log(`[FASE 6] Siguiendo redirect a: ${location302.substring(0, 120)}...`);
          const followRes = await this._nativeRequest(location302, cookieStore, {
            maxRedirects: 3,
            headers: { 
              'Referer': menuReferer,
              'Sec-Fetch-Dest': 'iframe',
              'Sec-Fetch-Mode': 'navigate'
            }
          });

          token = this._extractTokenFromUrl(followRes.finalUrl) || 
                  this._extractTokenFromUrl(followRes.headers.location || '') ||
                  this._extractTokenFromHtml(followRes.body);
          if (token) {
            console.log(`[FASE 6] ✅ Token extraído de URL/body final tras seguir redirect`);
            return token;
          }
        }

        // 3. Buscar token en el body HTML si vino 200
        token = this._extractTokenFromHtml(res302.body);
        if (token) {
          console.log(`[FASE 6] ✅ Token extraído del body HTML`);
          return token;
        }

      } catch (actionErr) {
        console.warn(`[FASE 6] Error con URL ${actionUrl.substring(0, 80)}: ${actionErr.message}`);
      }
    }

    // ── FASE 7 (FALLBACK): Probar si el code JWT funciona directamente ──
    if (session._loginCode) {
      console.log(`[FASE 7] Probando si el code JWT del login tiene acceso directo a API CPE...`);
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
        console.log(`[FASE 7] Test status: ${testRes.statusCode}`);
        if (testRes.statusCode === 200 || testRes.statusCode === 404) {
          console.log(`[FASE 7] ✅ Code JWT aceptado por API CPE`);
          return session._loginCode;
        }
      } catch (testErr) {
        console.warn(`[FASE 7] Test falló: ${testErr.message}`);
      }
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
    const proc = item.procedenciaMasiva || item.procedenciaIndivual || item.procedenciaIndividual || {};

    const rawEstado = String(item.indEstadoCpe ?? '').trim();
    let estado = 'DESCONOCIDO';
    if (rawEstado === '0' || rawEstado === '1') estado = 'ACEPTADO';
    else if (rawEstado === '2') estado = 'ANULADO';
    else if (rawEstado === '3') estado = 'AUTORIZADO';
    else if (rawEstado === '4') estado = 'NO_AUTORIZADO';
    else estado = rawEstado ? `ESTADO_${rawEstado}` : 'ACEPTADO';

    const montoGravado = Number(proc.mtoTotalValVentaGrabado ?? proc.mtoOpGravado ?? proc.mtoSubTotal ?? 0);
    const montoExonerado = Number(proc.mtoTotalValVentaExonerado ?? proc.mtoOpExonerado ?? 0);
    const montoInafecto = Number(proc.mtoTotalValVentaInafecto ?? proc.mtoOpInafecto ?? 0);
    const montoIgv = Number(proc.mtoSumIGV ?? proc.mtoIGV ?? 0);
    const montoIsc = Number(proc.mtoSumISC ?? proc.mtoISC ?? 0);
    const montoIcbper = Number(proc.mtoSumICBPER ?? proc.mtoICBPER ?? 0);
    const montoOtrosTributos = Number(proc.mtoSumOtrosTributos ?? proc.mtoOtrosTributos ?? 0);
    
    // Si montoTotal no viene en procedencia, calcular de items o sumatoria
    let montoTotal = Number(proc.mtoImporteTotal ?? item.mtoImpTotal ?? item.mtoTotal ?? 0);
    if (montoTotal === 0 && Array.isArray(item.informacionItems) && item.informacionItems.length > 0) {
      montoTotal = item.informacionItems.reduce((acc, it) => acc + Number(it.mtoImpTotal || 0), 0);
    }
    if (montoTotal === 0 && montoGravado > 0) {
      montoTotal = Number((montoGravado + montoIgv + montoExonerado + montoInafecto + montoIsc + montoIcbper + montoOtrosTributos).toFixed(2));
    }

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
      montoGravado,
      montoExonerado,
      montoInafecto,
      montoIgv,
      montoIsc,
      montoIcbper,
      montoOtrosTributos,
      montoTotal,
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
   * Consulta individual de un comprobante electrónico en SUNAT con auto-reintento
   */
  async consultarComprobante({ rucEmpresa, usuarioSol, claveSol, rucEmisor, tipoCpe, serie, correlativo, procedencia = '2', maxRetries = 3 }) {
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

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
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
        const errMsg = error.response?.data?.message || error.response?.data?.error || error.message || '';
        const isTransient = errMsg.includes('error processing') || error.response?.status === 500 || error.response?.status === 502 || error.response?.status === 503 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';

        if (isTransient && attempt <= maxRetries) {
          const backoffTime = 200 + (attempt * 250); // 450ms, 700ms, 950ms
          await new Promise(r => setTimeout(r, backoffTime));
          continue;
        }

        return {
          success: false,
          encontrado: false,
          error: errMsg || 'Error en microservicio SUNAT'
        };
      }
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

    for (let attempt = 1; attempt <= 2; attempt++) {
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

        if (res.data && res.data.comprobante) {
          const zipBase64 = res.data.comprobante;
          const fileName = `${rucLimpiado}-${tipoNormalizado}-${serieLimpiada}-${correlativoLimpiado}.xml`;

          return {
            success: true,
            encontrado: true,
            zipBase64,
            fileName,
            esZip: true
          };
        }

        return {
          success: false,
          error: 'XML no disponible para este comprobante en SUNAT'
        };
      } catch (error) {
        if (attempt === 1) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        return {
          success: false,
          error: error.response?.data?.message || error.response?.data?.error || error.message
        };
      }
    }
  }

  /**
   * Consulta masiva de comprobantes con concurrencia controlada, delay regulable y auto-reintento
   */
  async consultarLoteMasivo({ rucEmpresa, usuarioSol, claveSol, listaComprobantes, concurrencia = 2, delayMs = 180, onProgress }) {
    if (!Array.isArray(listaComprobantes) || listaComprobantes.length === 0) {
      throw new Error('La lista de comprobantes a consultar está vacía');
    }

    const total = listaComprobantes.length;
    const safeWorkers = Math.max(1, Math.min(concurrencia, total, 4));
    console.log(`[CPE BATCH START] 🚀 Iniciando lote de ${total} comprobantes para RUC ${rucEmpresa} (Concurrencia: ${safeWorkers}x, Delay: ${delayMs}ms)`);

    // 1. Asegurar sesión y token antes de iniciar el lote
    await this.obtenerTokenCpe(rucEmpresa, usuarioSol, claveSol);

    const resultados = [];
    const queue = [...listaComprobantes.map((item, index) => ({ item, index }))];
    const startTime = Date.now();

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
            procedencia: item.procedencia || '2',
            maxRetries: 3
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
          const lastRes = resultados[index]?.resultado;
          const statusDesc = lastRes ? `${lastRes.serie}-${lastRes.numero} -> ${lastRes.estado} (S/ ${lastRes.montoTotal})` : `${item.serie}-${item.numero} -> ${resultados[index]?.estado || 'PROCESADO'}`;
          
          if (stats.procesados % 5 === 0 || stats.procesados === total) {
            console.log(`[CPE BATCH PROGRESS] 📊 ${stats.procesados}/${total} (${Math.round(stats.procesados/total*100)}%) - Último: ${statusDesc}`);
          }

          if (typeof onProgress === 'function') {
            onProgress({
              total,
              procesados: stats.procesados,
              porcentaje: Math.round((stats.procesados / total) * 100),
              ultimoProcesado: resultados[index]
            });
          }

          // Delay de pacing para evitar rate-limiting de SUNAT API Gateway
          if (delayMs > 0 && queue.length > 0) {
            await new Promise(r => setTimeout(r, delayMs));
          }
        }
      }
    };

    // Ejecutar workers concurrentes seguros
    const workers = [];
    for (let i = 0; i < safeWorkers; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    // ═══ FASE DE BARRIDO AUTOMÁTICO (AUTOMATIC SWEEP PASS) ═══
    // Si algún comprobante tuvo error transitorio por saturación de SUNAT, se reintenta automáticamente
    for (let sweepPass = 1; sweepPass <= 2; sweepPass++) {
      const pendingErrors = resultados.map((r, idx) => ({ r, idx })).filter(item => item.r && item.r.estado === 'ERROR');
      if (pendingErrors.length === 0) break;

      console.log(`[CPE AUTO-SWEEP] 🔄 Barrido #${sweepPass}: Reintentando automáticamente ${pendingErrors.length} comprobante(s)...`);
      for (const { r, idx } of pendingErrors) {
        const item = r.itemOriginal;
        try {
          await new Promise(res => setTimeout(res, 400 * sweepPass));

          const retryRes = await this.consultarComprobante({
            rucEmpresa,
            usuarioSol,
            claveSol,
            rucEmisor: item.rucEmisor || item.ruc || item.doc_num,
            tipoCpe: item.tipoCpe || item.tipo || item.tipo_doc || '01',
            serie: item.serie,
            correlativo: item.numero || item.correlativo || item.numCpe,
            procedencia: item.procedencia || '2',
            maxRetries: 4
          });

          if (retryRes.success && retryRes.encontrado && retryRes.data) {
            const d = retryRes.data;
            stats.errores = Math.max(0, stats.errores - 1);
            if (d.estado === 'ACEPTADO') stats.aceptados++;
            else if (d.estado === 'ANULADO') stats.anulados++;
            else stats.aceptados++;

            stats.montoTotalGravado += d.montoGravado || 0;
            stats.montoTotalIgv += d.montoIgv || 0;
            stats.montoTotalGeneral += d.montoTotal || 0;

            resultados[idx] = {
              index: idx,
              itemOriginal: item,
              success: true,
              encontrado: true,
              resultado: d
            };
            console.log(`[CPE AUTO-SWEEP] ✅ ${d.serie}-${d.numero} recuperado exitosamente en auto-barrido #${sweepPass}: ${d.estado}`);
          } else if (retryRes.success && !retryRes.encontrado) {
            stats.errores = Math.max(0, stats.errores - 1);
            stats.noEncontrados++;
            resultados[idx] = {
              index: idx,
              itemOriginal: item,
              success: true,
              encontrado: false,
              estado: 'NO_EXISTE',
              mensaje: retryRes.mensaje || 'Comprobante no existe en SUNAT'
            };
          }
        } catch (e) {
          // Mantener como error si persistió
        }
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[CPE BATCH COMPLETE] ✅ Lote finalizado en ${elapsed}ms: ${stats.procesados}/${total} procesados (${stats.aceptados} Aceptados, ${stats.anulados} Anulados, ${stats.noEncontrados} No Existen, ${stats.errores} Errores)`);

    return {
      success: true,
      stats,
      resultados
    };
  }
}

module.exports = new SunatDirectCpeService();
