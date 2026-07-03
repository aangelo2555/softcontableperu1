const axios = require('axios');
const logger = require('./logger');

/**
 * Cliente para la API de SUNAT SIRE
 */
class SunatApiClient {
  constructor() {
    this.baseUrl = 'https://api-sire.sunat.gob.pe/v1';
    this.authUrl = 'https://api-seguridad.sunat.gob.pe/v1';
    this.token = null;
  }

  /**
   * Genera token de acceso OAuth2
   */
  async generarToken(credentials) {
    try {
      const ruc = credentials.ruc?.trim() || '';
      const usuario_sol = credentials.usuario_sol?.trim().toUpperCase() || '';
      const clave_sol = credentials.clave_sol?.trim() || '';
      const client_id = credentials.client_id?.trim() || '';
      const client_secret = credentials.client_secret?.trim() || '';

      logger.info('Generando token de acceso', { ruc });

      const params = new URLSearchParams({
        grant_type: 'password',
        scope: 'https://api-sire.sunat.gob.pe',
        client_id: client_id,
        client_secret: client_secret,
        username: `${ruc}${usuario_sol}`,
        password: clave_sol
      });

      const response = await axios.post(
        `${this.authUrl}/clientessol/${client_id}/oauth2/token/`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (response.data && response.data.access_token) {
        this.token = response.data.access_token;
        logger.info('Token generado exitosamente');
        return {
          success: true,
          token: this.token
        };
      }

      throw new Error('No se recibió token de acceso');

    } catch (error) {
      logger.error('Error al generar token', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.response?.data?.error_description || (error.response?.data ? JSON.stringify(error.response.data) : error.message)
      };
    }
  }

  /**
   * Extrae el número de ticket de una respuesta de error SUNAT (ej. error 42209 proceso en curso)
   */
  extraerTicketDeError(error) {
    const errorData = error.response?.data;
    if (!errorData) return null;

    const errorStr = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
    const match = errorStr.match(/Ticket:\s*(\d+)/i) || errorStr.match(/numTicket["']?:\s*["']?(\d+)/i);
    
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  /**
   * Descarga propuesta de Registro de Compras Electrónico (RCE)
   */
  async descargarPropuestaCompras(periodo) {
    try {
      logger.info('Descargando propuesta RCE', { periodo });

      const url = `${this.baseUrl}/contribuyente/migeigv/libros/rce/propuesta/web/propuesta/${periodo}/exportacioncomprobantepropuesta`;
      
      const response = await axios.get(url, {
        params: {
          codTipoArchivo: 0,
          codOrigenEnvio: 1
        },
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.data && response.data.numTicket) {
        logger.info('Propuesta RCE generada', { 
          numTicket: response.data.numTicket 
        });
        
        return {
          success: true,
          numTicket: response.data.numTicket
        };
      }

      throw new Error('No se recibió número de ticket');

    } catch (error) {
      const ticketExistente = this.extraerTicketDeError(error);
      if (ticketExistente) {
        logger.info('Se detectó ticket de propuesta RCE en curso en SUNAT', { numTicket: ticketExistente });
        return {
          success: true,
          numTicket: ticketExistente,
          ticketExistente: true
        };
      }

      logger.error('Error al descargar propuesta RCE', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.response?.data?.message || (error.response?.data ? JSON.stringify(error.response.data) : error.message)
      };
    }
  }

  /**
   * Descarga propuesta de Registro de Ventas e Ingresos Electrónico (RVIE)
   */
  async descargarPropuestaVentas(periodo) {
    try {
      logger.info('Descargando propuesta RVIE', { periodo });

      const url = `${this.baseUrl}/contribuyente/migeigv/libros/rvie/propuesta/web/propuesta/${periodo}/exportapropuesta`;
      
      const response = await axios.get(url, {
        params: {
          codTipoArchivo: 0
        },
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.data && response.data.numTicket) {
        logger.info('Propuesta RVIE generada', { 
          numTicket: response.data.numTicket 
        });
        
        return {
          success: true,
          numTicket: response.data.numTicket
        };
      }

      throw new Error('No se recibió número de ticket');

    } catch (error) {
      const ticketExistente = this.extraerTicketDeError(error);
      if (ticketExistente) {
        logger.info('Se detectó ticket de propuesta RVIE en curso en SUNAT', { numTicket: ticketExistente });
        return {
          success: true,
          numTicket: ticketExistente,
          ticketExistente: true
        };
      }

      logger.error('Error al descargar propuesta RVIE', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.response?.data?.message || (error.response?.data ? JSON.stringify(error.response.data) : error.message)
      };
    }
  }

  /**
   * Consulta el estado de un ticket
   */
  async consultarTicket(numTicket, periodoIni, periodoFin = null) {
    try {
      const perFin = periodoFin || periodoIni;
      
      logger.info('Consultando estado de ticket', { 
        numTicket, 
        periodoIni, 
        periodoFin: perFin 
      });

      const url = `${this.baseUrl}/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`;
      
      const response = await axios.get(url, {
        params: {
          perIni: periodoIni,
          perFin: perFin,
          page: 1,
          perPage: 20,
          numTicket: numTicket
        },
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.data && response.data.registros && response.data.registros.length > 0) {
        const registro = response.data.registros[0];
        
        logger.info('Estado de ticket consultado', {
          codProceso: registro.codProceso,
          estado: registro.estado
        });

        return {
          success: true,
          codProceso: registro.codProceso,
          numTicket: registro.numTicket,
          estado: registro.estado,
          archivoReporte: registro.archivoReporte || []
        };
      }

      throw new Error('No se encontró información del ticket');

    } catch (error) {
      logger.error('Error al consultar ticket', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.response?.data?.message || (error.response?.data ? JSON.stringify(error.response.data) : error.message)
      };
    }
  }

  /**
   * Descarga archivo de reporte (Compras)
   */
  async descargarArchivoCompras(params) {
    try {
      const { nomArchivoReporte, periodoIni, codTipoArchivoReporte, codProceso, numTicket } = params;

      logger.info('Descargando archivo RCE', { nomArchivoReporte });

      const url = `${this.baseUrl}/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`;
      
      const response = await axios.get(url, {
        params: {
          nomArchivoReporte,
          perTributario: periodoIni,
          codTipoArchivoReporte,
          codProceso,
          numTicket
        },
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        responseType: 'arraybuffer'
      });

      logger.info('Archivo RCE descargado exitosamente', {
        tamaño: response.data ? response.data.length : 0,
        contentType: response.headers['content-type']
      });

      // Validar que se descargó algo
      if (!response.data || response.data.length === 0) {
        throw new Error('El archivo descargado está vacío');
      }

      return {
        success: true,
        data: response.data,
        filename: nomArchivoReporte
      };

    } catch (error) {
      logger.error('Error al descargar archivo RCE', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Descarga archivo de reporte (Ventas)
   */
  async descargarArchivoVentas(params) {
    try {
      const { nomArchivoReporte, periodoIni, codTipoArchivoReporte, codProceso, numTicket } = params;

      logger.info('Descargando archivo RVIE', { nomArchivoReporte });

      const url = `${this.baseUrl}/contribuyente/migeigv/libros/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`;
      
      const response = await axios.get(url, {
        params: {
          nomArchivoReporte,
          codTipoArchivoReporte,
          codLibro: '140000',
          perTributario: periodoIni,
          codProceso,
          numTicket
        },
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        responseType: 'arraybuffer'
      });

      logger.info('Archivo RVIE descargado exitosamente', {
        tamaño: response.data ? response.data.length : 0,
        contentType: response.headers['content-type']
      });

      // Validar que se descargó algo
      if (!response.data || response.data.length === 0) {
        throw new Error('El archivo descargado está vacío');
      }

      return {
        success: true,
        data: response.data,
        filename: nomArchivoReporte
      };

    } catch (error) {
      logger.error('Error al descargar archivo RVIE', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Espera con polling hasta que el ticket esté listo
   */
  async esperarTicketListo(numTicket, periodoIni, periodoFin = null, maxIntentos = 30) {
    for (let intento = 1; intento <= maxIntentos; intento++) {
      logger.info(`Consultando ticket (intento ${intento}/${maxIntentos})`);

      const resultado = await this.consultarTicket(numTicket, periodoIni, periodoFin);

      if (!resultado.success) {
        throw new Error(resultado.error);
      }

      // Log detallado del estado
      logger.info('Estado del ticket', {
        estado: resultado.estado,
        codProceso: resultado.codProceso,
        tieneArchivos: resultado.archivoReporte?.length > 0
      });

      const estStr = String(resultado.estado || '').trim();

      // Estado 3, "3", "03" = Procesado exitosamente por SUNAT
      if (estStr === '3' || estStr === '03' || estStr === '3.0' || estStr === 'PROCESADO' || estStr === 'TERMINADO') {
        logger.info('Ticket procesado exitosamente por SUNAT', { estado: estStr, intento });
        return resultado;
      }

      // Estado 4, "4", "04" = Error en procesamiento de SUNAT
      if (estStr === '4' || estStr === '04' || estStr === 'ERROR') {
        throw new Error('El ticket fue procesado con errores en SUNAT');
      }

      // Si se han realizado al menos 3 intentos (>=7 segs) y SUNAT no cambió el código de estado pero ya generó archivos de reporte
      if (intento >= 3 && resultado.archivoReporte && resultado.archivoReporte.length > 0) {
        logger.info('Ticket contiene archivos de reporte tras intentos iniciales (>=3), considerando como completado');
        return resultado;
      }

      // Esperar 2 segundos antes del siguiente intento
      await this.sleep(2000);
    }

    throw new Error('Timeout: El ticket no se procesó en el tiempo esperado');
  }

  /**
   * Utilidad para esperar
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SunatApiClient;
