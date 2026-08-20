# 📘 Guía Maestra: Metodología de Ingeniería Inversa HTTP para Portales Web Complejos (Caso SUNAT)

Esta guía documenta la metodología técnica paso a paso para analizar, descifrar y automatizar flujos de autenticación y consumo de APIs en portales gubernamentales o empresariales complejos (como el portal SOL de SUNAT, SAT, AFIP, SRI, etc.) mediante **Ingeniería Inversa HTTP**.

---

## 📑 Tabla de Contenidos
1. [Filosofía y Principios Fundamentales](#1-filosofía-y-principios-fundamentales)
2. [Herramientas del Detective HTTP](#2-herramientas-del-detective-http)
3. [Fase 1: Mapeo Inicial del Flujo en DevTools](#fase-1-mapeo-inicial-del-flujo-en-devtools)
4. [Fase 2: La Técnica de los Scratch Scripts (Sondeo Aislado)](#fase-2-la-técnica-de-los-scratch-scripts-sondeo-aislado)
5. [Fase 3: Descifrando el Handshake OAuth2 y Manejo de Sesión](#fase-3-descifrando-el-handshake-oauth2-y-manejo-de-sesión)
6. [Fase 4: Consumo de APIs Internas y Descarga de Archivos](#fase-4-consumo-de-apis-internas-y-descarga-de-archivos)
7. [Errores Comunes y Gotchas Críticos](#errores-comunes-y-gotchas-críticos)
8. [Plantilla Base Reutilizable (Node.js)](#plantilla-base-reutilizable-nodejs)

---

## 1. Filosofía y Principios Fundamentales

Cuando un portal web no ofrece una API pública documentada para una función específica (por ejemplo, consulta masiva de comprobantes CPE o descarga de XMLs), el navegador web ya está realizando esas peticiones de forma legítima.

> **Regla de Oro:**  
> *"Si el navegador puede hacerlo mediante clics, tu backend puede reproducir exactamente la misma secuencia de bytes y cabeceras HTTP."*

Para lograrlo, dividimos el problema en 3 capas:
1. **Identidad:** Cómo se autentica el usuario (Usuario/Clave -> Cookies / Tickets).
2. **Autorización:** Cómo el portal entrega permisos a sub-módulos (Tokens JWT / OAuth2).
3. **Consumo:** Qué endpoints REST/SOAP reciben esos tokens para responder datos o archivos.

---

## 2. Herramientas del Detective HTTP

| Herramienta | Propósito |
|---|---|
| **Chrome DevTools (F12)** | Captura pasiva del tráfico de red real. |
| **Node.js (`https` nativo)** | Motor de peticiones con control granular de cabeceras, redirects y cookies. |
| **Scratch Scripts (`scratch/*.js`)** | Scripts de prueba de 20-30 líneas para probar hipótesis en segundos. |
| **Regex & String Parsers** | Extracción de tokens, states ocultos y scripts inline. |
| **jwt.io / Buffer Base64** | Inspección y decodificación de payloads de tokens JWT. |

---

## Fase 1: Mapeo Inicial del Flujo en DevTools

Antes de escribir una sola línea de código, abre DevTools en Chrome y realiza la configuración esencial:

### ⚙️ Configuración indispensable en DevTools:
1. Pestaña **Network**.
2. Marcar **Preserve log** (para que las redirecciones 302 no borren el historial).
3. Marcar **Disable cache** (para ver las peticiones reales siempre).
4. Alternar entre filtros:
   - **`Doc`**: Para ver las páginas HTML y saltos de redirección 302.
   - **`Fetch/XHR`**: Para ver las llamadas a APIs REST/JSON.

### 📸 Qué capturar en cada paso:
1. **Paso 1 (Login):**
   - URL del formulario inicial y método (`GET`/`POST`).
   - Endpoint de envío de credenciales (ej. `j_security_check`).
   - Parámetros enviados en el `Payload` (formulario `x-www-form-urlencoded`).
2. **Paso 2 (Redirecciones y Cookies):**
   - Código HTTP de respuesta (`302 Moved Temporarily` vs `200 OK`).
   - Cabecera `Location` (hacia dónde te envía el servidor).
   - Cabecera `Set-Cookie` (nombre de las cookies generadas).
3. **Paso 3 (Acción de Menú / Clic):**
   - URL solicitada al hacer clic en la opción deseada.
   - Cabecera `Referer` enviada por el navegador.
   - Si la respuesta es un 302, inspeccionar la URL destino: a menudo contiene `?token=eyJ...`.
4. **Paso 4 (Llamada al Endpoint de Datos):**
   - URL de la API (ej. `https://api-cpe.sunat.gob.pe/v1/...`).
   - Cabecera `Authorization: Bearer <TOKEN>`.
   - Formato del Response JSON (`comprobantes`, `totalRegistros`, etc.).

---

## Fase 2: La Técnica de los Scratch Scripts (Sondeo Aislado)

Cuando una petición falla en el backend (por ejemplo, devuelve 200 en lugar del 302 esperado), **no adivines ni despliegues a ciegas**. Crea un script temporal:

```javascript
// scratch/probe.js
const https = require('https');

const options = {
  hostname: 'e-menu.sunat.gob.pe',
  path: '/cl-ti-itmenu/MenuInternet.htm',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
};

https.get(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Location:', res.headers.location);
  console.log('Set-Cookie:', res.headers['set-cookie']);
  
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    // Buscar scripts con redirecciones o tokens ocultos
    const scripts = body.match(/<script[\s\S]*?<\/script>/gi) || [];
    scripts.forEach((s, idx) => console.log(`Script ${idx}:`, s));
  });
});
```

Ejecuta con:
```bash
node scratch/probe.js
```

### 🎯 Lo que reveló esta técnica en SUNAT:
Al inspeccionar el HTML de `MenuInternet.htm`, descubrimos que contenía un script de arranque:
```javascript
$(document).ready(function(){
  redirect("https://api-seguridad.sunat.gob.pe/.../oauth2/authen?redirect_uri=...&state=rO0ABXNyABFqYXZh...&client_id=4f3b88b3...&response_type=code");
});
```
> **Descubrimiento:** `MenuInternet.htm` genera el parámetro criptográfico `state` (un objeto Java serializado `rO0AB...`) requerido obligatoriamente para que el login sea reconocido como válido.

---

## Fase 3: Descifrando el Handshake OAuth2 y Manejo de Sesión

### Diagrama del Flujo Completo Descifrado:

```
[1. GET MenuInternet.htm] 
   └── Extraer 'state' del script redirect(...)
         │
[2. GET oauth2/authen?state=...] 
   └── Inicializar cookies en api-seguridad.sunat.gob.pe
         │
[3. POST j_security_check] (tipo=2, ruc, usuario, password, state)
   └── Capturar 302 -> Location: AutenticaMenuInternet.htm?state=...&code=eyJ...
         │
[4. GET AutenticaMenuInternet.htm?state=...&code=...]
   └── Establecer cookie de sesión global: ITMENUSESSION
         │
[5. GET MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1]
   └── Capturar 302 -> Location: ...nuevaconsulta.html?token=eyJraWQiOiJhcGktY3Bl...
         │
[6. Extraer Bearer Token de la URL]
```

### Manejo Plano Unificado de Cookies:
Las librerías tradicionales (como `tough-cookie`) a veces aíslan cookies por subdominio (`api-seguridad` vs `e-menu` vs `e-factura`).  
**Solución:** Usar un almacén plano (`cookieStore[name] = value`) para que todas las cookies acumuladas viajen en todas las peticiones hacia el dominio raíz `.sunat.gob.pe`.

---

## Fase 4: Consumo de APIs Internas y Descarga de Archivos

Una vez obtenido el Bearer Token JWT:

### 1. Consulta de Comprobantes (JSON):
```http
GET /v1/contribuyente/consultacpe/comprobantes?numRuc=20609936224&codCpe=01&numSerie=E001&numCpe=1&procedencia=2 HTTP/1.1
Host: api-cpe.sunat.gob.pe
Authorization: Bearer <TOKEN_JWT>
Accept: application/json
```

### 2. Descarga de Archivo XML Oficial (ZIP en Base64):
```http
GET /v1/contribuyente/consultacpe/comprobantes/02?numRuc=20609936224&codCpe=01&numSerie=E001&numCpe=1&procedencia=2 HTTP/1.1
Host: api-cpe.sunat.gob.pe
Authorization: Bearer <TOKEN_JWT>
Accept: application/json
```

**Respuesta:**
```json
{
  "nomArchivo": "20609936224-01-E001-1-XML.zip",
  "valArchivo": "UEsDBBQACAgIACkTFF0AAAAAAAAAAAAAAAAeAAAARkFDVFVSQUUwMDEtMS54bWw..."
}
```

**Descompresión en memoria (Node.js):**
```javascript
const AdmZip = require('adm-zip');

const zipBuffer = Buffer.from(response.data.valArchivo, 'base64');
const zip = new AdmZip(zipBuffer);
const zipEntries = zip.getEntries();

for (const entry of zipEntries) {
  if (entry.entryName.endsWith('.xml')) {
    const xmlText = entry.getData().toString('utf8');
    console.log('XML extraído:', xmlText.substring(0, 200));
  }
}
```

---

## Errores Comunes y Gotchas Críticos

1. **`maxRedirects` automático (Seguir redirects ciegamente):**
   - *Problema:* Si una librería sigue automáticamente los redirects 302, pierdes la cabecera `Location` donde venía el `token` o el `code`.
   - *Solución:* Usar `maxRedirects: 0` en pasos clave para inspeccionar el 302 crudo.

2. **Parámetro `Referer` faltante:**
   - *Problema:* El servidor devuelve `200` recargando el menú en vez del `302`.
   - *Solución:* Enviar el `Referer` exacto que tenía la pestaña previa (ej. `https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?pestana=*&agrupacion=*`).

3. **Cabeceras de contexto de navegador (`Sec-Fetch-*`):**
   - En peticiones que simulan iframes, incluir:
     ```http
     Sec-Fetch-Dest: iframe
     Sec-Fetch-Mode: navigate
     Sec-Fetch-Site: same-origin
     Sec-Fetch-User: ?1
     Upgrade-Insecure-Requests: 1
     ```

4. **Cookies de usuario en formato plano:**
   - SUNAT exige que la cookie `${RUC}${USUARIO}=1` (ej. `20612314579SQUATIOT=1`) exista en el store.

---

## Plantilla Base Reutilizable (Node.js)

```javascript
const https = require('https');
const { URL } = require('url');

class HttpReverseEngine {
  constructor() {
    this.cookieStore = {};
  }

  request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const reqOptions = {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'Host': parsed.hostname,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-PE,es;q=0.9',
          ...(options.headers || {})
        }
      };

      // Inyectar cookies acumuladas
      const cookieStr = Object.entries(this.cookieStore)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      if (cookieStr) reqOptions.headers['Cookie'] = cookieStr;

      if (options.body) {
        reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
      }

      const req = https.request(reqOptions, (res) => {
        // Almacenar Set-Cookie
        const setCookies = res.headers['set-cookie'];
        if (setCookies) {
          const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
          arr.forEach(c => {
            const nv = c.split(';')[0].trim();
            const eq = nv.indexOf('=');
            if (eq > 0) this.cookieStore[nv.substring(0, eq)] = nv.substring(eq + 1);
          });
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          finalUrl: url
        }));
      });

      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }
}

module.exports = HttpReverseEngine;
```

---
*Documento generado para el equipo de desarrollo de Softcontable — 2026.*
