const SunatApiClient = require('./sunatApi');
const FileProcessor = require('./fileProcessor');
const ExcelGenerator = require('./excelGenerator');
const logger = require('./logger');

/**
 * Orquestador principal del proceso SIRE
 */
class SireOrchestrator {
  constructor() {
    this.apiClient = new SunatApiClient();
    this.fileProcessor = new FileProcessor();
    this.excelGenerator = new ExcelGenerator();
  }

  /**
   * Ejecuta el proceso completo de descarga SIRE
   */
  async ejecutarDescarga(params) {
    const {
      ruc,
      empresa,
      proceso,
      periodoInicio,
      periodoFin,
      rangoActivo,
      credentials,
      diaInicio,
      diaFin
    } = params;

    try {
      logger.info('Iniciando proceso SIRE', {
        ruc,
        proceso,
        periodoInicio,
        periodoFin: rangoActivo ? periodoFin : 'N/A'
      });

      // 1. Generar token de acceso
      const tokenResult = await this.apiClient.generarToken(credentials);

      if (!tokenResult.success) {
        throw new Error(`Error al generar token: ${tokenResult.error}`);
      }

      // 2. Determinar períodos a procesar
      const periodos = this.generarListaPeriodos(
        periodoInicio,
        rangoActivo ? periodoFin : periodoInicio
      );

      logger.info(`Procesando ${periodos.length} período(s)`, {
        diaInicio,
        diaFin: rangoActivo ? diaFin : diaInicio
      });

      // 3. Procesar cada período
      let excelPath = null;
      let totalRegistros = 0;
      let lastResultado = null;

      for (let i = 0; i < periodos.length; i++) {
        const periodo = periodos[i];

        logger.info(`Procesando período ${i + 1}/${periodos.length}: ${periodo}`);

        // Descargar y procesar período
        lastResultado = await this.procesarPeriodo(
          periodo,
          proceso,
          ruc,
          empresa,
          excelPath,
          diaInicio,
          rangoActivo && i === periodos.length - 1 ? diaFin : null,
          params.plan
        );

        if (!lastResultado.success) {
          throw new Error(`Error en período ${periodo}: ${lastResultado.error}`);
        }

        // Guardar path del Excel (se crea en el primer período)
        if (!excelPath) {
          excelPath = lastResultado.excelPath;
        }

        totalRegistros += lastResultado.registros;

        // Pequeña pausa entre períodos
        if (i < periodos.length - 1) {
          await this.sleep(1000);
        }
      }

      // 4. Limpiar archivos temporales
      this.fileProcessor.limpiarTemp();

      logger.info('Proceso SIRE completado exitosamente', {
        totalRegistros,
        excelPath
      });

      return {
        success: true,
        message: 'Proceso completado exitosamente',
        excelPath: excelPath,
        totalRegistros: totalRegistros,
        periodosProcesados: periodos.length,
        datosRaw: lastResultado ? lastResultado.datosRaw : null
      };

    } catch (error) {
      logger.error('Error en proceso SIRE', { error: error.message });

      // Limpiar en caso de error
      this.fileProcessor.limpiarTemp();

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Procesa un período individual
   */
  async procesarPeriodo(periodo, proceso, ruc, empresa, excelExistente = null, diaInicio = 1, diaFin = null, plan = null) {
    try {
      // 1. Descargar propuesta
      let propuestaResult;

      if (proceso === 'Generar RCE') {
        propuestaResult = await this.apiClient.descargarPropuestaCompras(periodo);
      } else {
        propuestaResult = await this.apiClient.descargarPropuestaVentas(periodo);
      }

      if (!propuestaResult.success) {
        throw new Error(propuestaResult.error);
      }

      const numTicket = propuestaResult.numTicket;

      // 2. Esperar a que el ticket esté listo
      logger.info('Esperando procesamiento del ticket...', { numTicket });

      const ticketResult = await this.apiClient.esperarTicketListo(
        numTicket,
        periodo,
        periodo,
        40 // máximo 40 intentos (80 segundos) para evitar timeout de Railway (100s)
      );

      if (!ticketResult.archivoReporte || ticketResult.archivoReporte.length === 0) {
        throw new Error('No se generó archivo de reporte');
      }

      const archivoInfo = ticketResult.archivoReporte[0];

      // 3. Descargar archivo
      let archivoResult;

      const downloadParams = {
        nomArchivoReporte: archivoInfo.nomArchivoReporte,
        periodoIni: periodo,
        codTipoArchivoReporte: archivoInfo.codTipoArchivoReporte,
        codProceso: ticketResult.codProceso,
        numTicket: numTicket
      };

      if (proceso === 'Generar RCE') {
        archivoResult = await this.apiClient.descargarArchivoCompras(downloadParams);
      } else {
        archivoResult = await this.apiClient.descargarArchivoVentas(downloadParams);
      }

      if (!archivoResult.success) {
        throw new Error(archivoResult.error);
      }

      // 4. Procesar archivo ZIP
      const procesarResult = await this.fileProcessor.procesarZip(
        archivoResult.data,
        archivoResult.filename
      );

      if (!procesarResult.success) {
        throw new Error(procesarResult.error);
      }

      // 5. Validar límites
      const validacion = this.fileProcessor.validarLimites(
        procesarResult.datos.totalRegistros,
        proceso,
        plan // Pasar el plan para validación
      );

      if (!validacion.valido) {
        throw new Error(validacion.mensaje);
      }

      // 6. Generar o actualizar Excel
      let excelResult;

      // Agregar información adicional a los datos
      procesarResult.datos.periodo = periodo;
      procesarResult.datos.ruc = ruc;
      procesarResult.datos.empresa = empresa;

      if (!excelExistente) {
        // Crear nuevo Excel
        if (proceso === 'Generar RCE') {
          excelResult = await this.excelGenerator.generarRegistroCompras(
            procesarResult.datos,
            ruc,
            periodo
          );
        } else {
          excelResult = await this.excelGenerator.generarRegistroVentas(
            procesarResult.datos,
            ruc,
            periodo
          );
        }
      } else {
        // Agregar a Excel existente
        excelResult = await this.excelGenerator.agregarDatosExistente(
          excelExistente,
          procesarResult.datos
        );
      }

      if (!excelResult.success) {
        throw new Error(excelResult.error);
      }

      return {
        success: true,
        excelPath: excelResult.filepath,
        registros: procesarResult.datos.totalRegistros,
        datosRaw: procesarResult.datos
      };

    } catch (error) {
      logger.error('Error al procesar período', {
        periodo,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Genera lista de períodos entre inicio y fin
   */
  generarListaPeriodos(periodoIni, periodoFin) {
    const periodos = [];

    let anioActual = Math.floor(periodoIni / 100);
    let mesActual = periodoIni % 100;

    const anioFin = Math.floor(periodoFin / 100);
    const mesFin = periodoFin % 100;

    while (true) {
      const periodoActual = anioActual * 100 + mesActual;
      periodos.push(periodoActual);

      // Si llegamos al período final, salir
      if (periodoActual >= periodoFin) {
        break;
      }

      // Avanzar al siguiente mes
      mesActual++;
      if (mesActual > 12) {
        mesActual = 1;
        anioActual++;
      }

      // Protección contra loops infinitos
      if (periodos.length > 120) { // máximo 10 años
        logger.warn('Se alcanzó el límite de períodos');
        break;
      }
    }

    return periodos;
  }

  /**
   * Abre el Excel generado
   */
  async abrirExcelGenerado(filepath) {
    return await this.excelGenerator.abrirExcel(filepath);
  }

  /**
   * Utilidad para esperar
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SireOrchestrator;
