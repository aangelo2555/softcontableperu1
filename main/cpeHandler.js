const axios = require('axios');
const path = require('path');
const fs = require('fs');
const logger = require('./logger_web');
const { buzonDir } = require('../server/storageConfig');

const AUTH_URL = 'https://api-seguridad.sunat.gob.pe/v1';
const CPE_API_URL = 'https://api-cpe.sunat.gob.pe/v1/contribuyente';
let tokenCache = {};

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

  /**
   * Obtiene token OAuth2 para API CPE (consulta y descarga de comprobantes)
   */
  async getTokenCPE(credentials) {
    const { ruc, usuario_sol, clave_sol, client_id, client_secret } = credentials;

    const cacheKey = `token_cpe_${ruc}`;
    const cached = tokenCache[cacheKey];

    if (cached && cached.expiresAt > Date.now() + 60000) {
      logger.info('[CPE API] Usando token CPE cacheado');
      return { success: true, token: cached.access_token };
    }

    try {
      const url = `${AUTH_URL}/clientessol/${client_id}/oauth2/token/`;

      const params = new URLSearchParams({
        grant_type: 'password',
        scope: 'https://api-cpe.sunat.gob.pe',
        client_id: client_id,
        client_secret: client_secret,
        username: `${ruc}${usuario_sol}`,
        password: clave_sol
      });

      logger.info('[CPE API] Solicitando token CPE (password grant)', { ruc });

      const response = await axios.post(url, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;

      tokenCache[cacheKey] = {
        access_token: token,
        expiresAt: Date.now() + (expiresIn * 1000)
      };

      logger.info('[CPE API] Token CPE obtenido exitosamente', { expiresIn });
      return { success: true, token, expiresIn };

    } catch (error) {
      logger.error('[CPE API] Error al obtener token CPE', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      let errorMsg = 'Error al obtener token CPE';
      if (error.response?.data?.error_description) {
        errorMsg = error.response.data.error_description;
      } else if (error.response?.status === 400) {
        errorMsg = 'Credenciales inválidas';
      }

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Proceso principal para descargar lote de comprobantes
   */
  async descargarLoteCPE({ ruc, usuario, clave, client_id, client_secret, facturas }) {
    logger.info(`[CPE API] Iniciando proceso de descarga API Oficial para RUC ${ruc}`);
    let resultados = [];

    if (!client_id || !client_secret) {
        logger.error('[CPE API] Faltan Client ID o Client Secret para usar la API Oficial de SUNAT.');
        return facturas.map(f => ({ id: f.id, estado: 'ERROR_CREDENCIALES_API' }));
    }

    const tokenResult = await this.getTokenCPE({ 
        ruc, 
        usuario_sol: usuario, 
        clave_sol: clave, 
        client_id, 
        client_secret 
    });

    if (!tokenResult.success) {
        logger.error(`[CPE API] Falla al obtener token: ${tokenResult.error}`);
        return facturas.map(f => ({ id: f.id, estado: 'ERROR_SIN_TOKEN' }));
    }

    const tokenJWT = tokenResult.token;

    for (const factura of facturas) {
       const { rucEmisor, tipoDoc, serie, numero, fechaEmision, total } = factura;
       logger.info(`[CPE API] Consultando comprobante: ${rucEmisor} - ${tipoDoc} - ${serie}-${numero}`);
       
       try {
           const payload = {
               "codComp": tipoDoc,
               "numeroSerie": serie,
               "numero": numero,
               "fechaEmision": fechaEmision,
               "monto": total || 0,
               "codTipoOpe": "2" // 2 = Recibido
           };

           const response = await axios.post(`${CPE_API_URL}/consultacpe/consulta/comprobante`, {
               rucEmisor,
               numDocIdeReceptor: ruc,
               ...payload
           }, {
               headers: {
                   'Authorization': `Bearer ${tokenJWT}`,
                   'Content-Type': 'application/json',
                   'Accept': 'application/json, text/plain, */*'
               },
               timeout: 30000
           });

           const resData = response.data;
           if (resData && resData.codEstadoCpe === "1") { // ACEPTADO
               logger.info(`[CPE API] Factura ${serie}-${numero} ACEPTADA. Procesando archivos...`);
               
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
       } catch (err) {
           logger.error(`[CPE API] Error procesando factura ${serie}-${numero}: ${err.message}`);
           let estado = 'ERROR_API_SUNAT';
           if (err.response?.status === 404) estado = 'NO_EXISTE';
           if (err.response?.status === 401) estado = 'NO_AUTORIZADO';
           resultados.push({
               id: factura.id,
               estado
           });
       }
       
       // Evitar colapsar la API
       await new Promise(r => setTimeout(r, 200));
    }

    return resultados;
  }
}

module.exports = new CpeHandler();
