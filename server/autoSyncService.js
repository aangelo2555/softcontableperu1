/**
 * Servicio de Sincronización Automática
 * - Buzón Electrónico automático cuando se configuren credenciales SOL
 * - SIRE automático desde enero hasta mes actual cuando se configuren credenciales SIRE
 */

const buzonHandler = require('../main/buzonHandler');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('./databasePostgres') : require('./databaseServer');

class AutoSyncService {
  constructor() {
    this.syncInProgress = new Map(); // ruc -> { buzon: boolean, sire: boolean }
    this.lastSyncTime = new Map(); // ruc -> { buzon: timestamp, sire: timestamp }
    this.THROTTLE_MINUTES = 10; // Mínimo intervalo entre sincronizaciones (10 minutos)
  }

  /**
   * Verifica si las credenciales SOL están completas para un workspace
   */
  hasValidSOLCredentials(workspace) {
    return !!(
      workspace.sol_user &&
      workspace.sol_user.trim() !== '' &&
      workspace.sol_pass &&
      workspace.sol_pass.trim() !== ''
    );
  }

  /**
   * Verifica si las credenciales SIRE están completas para un workspace
   */
  hasValidSIRECredentials(workspace) {
    return !!(
      workspace.sunatClientId &&
      workspace.sunatClientId.trim() !== '' &&
      workspace.sunatClientSecret &&
      workspace.sunatClientSecret.trim() !== ''
    );
  }

  /**
   * Verifica si es necesario ejecutar sincronización (throttling)
   */
  shouldSyncBuzon(ruc) {
    const lastSync = this.lastSyncTime.get(ruc)?.buzon;
    if (!lastSync) return true;

    const now = Date.now();
    const elapsedMinutes = (now - lastSync) / (1000 * 60);
    return elapsedMinutes >= this.THROTTLE_MINUTES;
  }

  /**
   * Verifica si es necesario ejecutar sincronización SIRE (throttling)
   */
  shouldSyncSIRE(ruc) {
    const lastSync = this.lastSyncTime.get(ruc)?.sire;
    if (!lastSync) return true;

    const now = Date.now();
    const elapsedMinutes = (now - lastSync) / (1000 * 60);
    return elapsedMinutes >= this.THROTTLE_MINUTES;
  }

  /**
   * Ejecuta la sincronización automática del Buzón Electrónico
   * Solo para la empresa especificada
   */
  async autoSyncBuzon(workspace) {
    const ruc = workspace.ruc;

    // Throttling - verificar si es necesario sincronizar
    if (!this.shouldSyncBuzon(ruc)) {
      const lastSync = this.lastSyncTime.get(ruc)?.buzon;
      const elapsed = Math.floor((Date.now() - lastSync) / (1000 * 60));
      console.log(`[AUTO SYNC] Buzón para ${ruc} ya sincronizado hace ${elapsed} min (throttle: ${this.THROTTLE_MINUTES} min)`);
      return { success: false, error: 'Sincronización reciente, esperando throttle' };
    }

    // Prevenir ejecuciones duplicadas
    if (this.syncInProgress.get(ruc)?.buzon) {
      console.log(`[AUTO SYNC] Buzón ya en ejecución para ${ruc}`);
      return { success: false, error: 'Sincronización ya en progreso' };
    }

    try {
      // Marcar como en progreso
      const current = this.syncInProgress.get(ruc) || {};
      this.syncInProgress.set(ruc, { ...current, buzon: true });

      console.log(`[AUTO SYNC] Iniciando consulta automática de Buzón para ${workspace.name} (${ruc})`);

      const result = await buzonHandler.consultarBuzon({
        ruc: workspace.ruc,
        usuario: workspace.sol_user,
        clave: workspace.sol_pass,
        email: null, // No enviar email en sincronización automática
        empresa: workspace.name
      });

      // Registrar hora de sincronización exitosa
      const currentTime = this.lastSyncTime.get(ruc) || {};
      this.lastSyncTime.set(ruc, { ...currentTime, buzon: Date.now() });

      console.log(`[AUTO SYNC] Buzón consultado para ${ruc}: ${result.mensajes?.length || 0} mensajes`);

      return result;
    } catch (error) {
      console.error(`[AUTO SYNC] Error al consultar buzón para ${ruc}:`, error);
      return { success: false, error: error.message };
    } finally {
      // Liberar lock
      const current = this.syncInProgress.get(ruc) || {};
      this.syncInProgress.set(ruc, { ...current, buzon: false });
    }
  }

  /**
   * Ejecuta la sincronización automática de SIRE
   * Descarga desde enero hasta el mes actual
   * Solo para la empresa especificada
   */
  async autoSyncSIRE(workspace) {
    const ruc = workspace.ruc;

    // Throttling - verificar si es necesario sincronizar
    if (!this.shouldSyncSIRE(ruc)) {
      const lastSync = this.lastSyncTime.get(ruc)?.sire;
      const elapsed = Math.floor((Date.now() - lastSync) / (1000 * 60));
      console.log(`[AUTO SYNC] SIRE para ${ruc} ya sincronizado hace ${elapsed} min (throttle: ${this.THROTTLE_MINUTES} min)`);
      return { success: false, error: 'Sincronización reciente, esperando throttle' };
    }

    // Prevenir ejecuciones duplicadas
    if (this.syncInProgress.get(ruc)?.sire) {
      console.log(`[AUTO SYNC] SIRE ya en ejecución para ${ruc}`);
      return { success: false, error: 'Sincronización ya en progreso' };
    }

    try {
      // Marcar como en progreso
      const current = this.syncInProgress.get(ruc) || {};
      this.syncInProgress.set(ruc, { ...current, sire: true });

      console.log(`[AUTO SYNC] Iniciando descarga automática de SIRE para ${workspace.name} (${ruc})`);

      // Calcular períodos: enero del año actual hasta el mes actual
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12

      const periodoInicio = currentYear * 100 + 1; // Enero del año actual
      const periodoFin = currentYear * 100 + currentMonth; // Mes actual

      console.log(`[AUTO SYNC] Descargando SIRE desde ${periodoInicio} hasta ${periodoFin} para ${ruc}`);

      // Ejecutar descarga de compras (RCE)
      const resultCompras = await sireHandler.ejecutarSireDescarga({
        ruc: workspace.ruc,
        empresa: workspace.name,
        proceso: 'Generar RCE',
        periodoInicio,
        periodoFin,
        rangoActivo: true,
        credentials: {
          ruc: workspace.ruc,
          usuario_sol: workspace.sol_user,
          clave_sol: workspace.sol_pass,
          client_id: workspace.sunatClientId,
          client_secret: workspace.sunatClientSecret
        },
        diaInicio: 1,
        diaFin: 31,
        plan: null // Sin plan específico
      });

      if (!resultCompras.success) {
        throw new Error(`Error en descarga de compras: ${resultCompras.error}`);
      }

      console.log(`[AUTO SYNC] SIRE Compras descargado para ${ruc}: ${resultCompras.totalRegistros || 0} registros`);

      // Ejecutar descarga de ventas (RVIE)
      const resultVentas = await sireHandler.ejecutarSireDescarga({
        ruc: workspace.ruc,
        empresa: workspace.name,
        proceso: 'Generar RVIE',
        periodoInicio,
        periodoFin,
        rangoActivo: true,
        credentials: {
          ruc: workspace.ruc,
          usuario_sol: workspace.sol_user,
          clave_sol: workspace.sol_pass,
          client_id: workspace.sunatClientId,
          client_secret: workspace.sunatClientSecret
        },
        diaInicio: 1,
        diaFin: 31,
        plan: null
      });

      if (!resultVentas.success) {
        throw new Error(`Error en descarga de ventas: ${resultVentas.error}`);
      }

      console.log(`[AUTO SYNC] SIRE Ventas descargado para ${ruc}: ${resultVentas.totalRegistros || 0} registros`);

      // Registrar hora de sincronización exitosa
      const currentTime = this.lastSyncTime.get(ruc) || {};
      this.lastSyncTime.set(ruc, { ...currentTime, sire: Date.now() });

      return {
        success: true,
        compras: resultCompras,
        ventas: resultVentas,
        mensaje: `SIRE descargado automáticamente desde ${periodoInicio} hasta ${periodoFin}`
      };

    } catch (error) {
      console.error(`[AUTO SYNC] Error al descargar SIRE para ${ruc}:`, error);
      return { success: false, error: error.message };
    } finally {
      // Liberar lock
      const current = this.syncInProgress.get(ruc) || {};
      this.syncInProgress.set(ruc, { ...current, sire: false });
    }
  }

  /**
   * Verifica y ejecuta sincronizaciones automáticas necesarias
   * Se llama cuando se guarda o actualiza un workspace, O cuando se carga uno existente
   */
  async checkAndSync(workspace, userId) {
    const results = {
      buzon: null,
      sire: null
    };

    // Verificar si tiene credenciales SOL válidas y ejecutar buzón
    if (this.hasValidSOLCredentials(workspace)) {
      console.log(`[AUTO SYNC] Credenciales SOL detectadas para ${workspace.ruc}, iniciando buzón automático`);
      results.buzon = await this.autoSyncBuzon(workspace);
    }

    // Verificar si tiene credenciales SIRE válidas y ejecutar SIRE
    if (this.hasValidSIRECredentials(workspace) && this.hasValidSOLCredentials(workspace)) {
      console.log(`[AUTO SYNC] Credenciales SIRE detectadas para ${workspace.ruc}, iniciando descarga automática`);
      results.sire = await this.autoSyncSIRE(workspace);
    }

    return results;
  }

  /**
   * Verifica y ejecuta sincronizaciones automáticas necesarias SOLO para cargas (con throttling)
   * Se llama cuando se carga un workspace existente (GET endpoint)
   */
  async checkAndSyncOnLoad(workspace, userId) {
    const ruc = workspace.ruc;
    
    // Verificar si nunca se ha sincronizado (primera vez)
    const lastSync = this.lastSyncTime.get(ruc);
    const isFirstTime = !lastSync || (!lastSync.buzon && !lastSync.sire);
    
    if (isFirstTime) {
      console.log(`[AUTO SYNC ON LOAD] Primera sincronización para ${ruc}, omitiendo throttling`);
      return await this.checkAndSync(workspace, userId);
    }
    
    // Solo ejecutar si tenemos credenciales válidas Y ha pasado suficiente tiempo
    const shouldSyncBuzon = this.hasValidSOLCredentials(workspace) && this.shouldSyncBuzon(ruc);
    const shouldSyncSIRE = this.hasValidSIRECredentials(workspace) && this.hasValidSOLCredentials(workspace) && this.shouldSyncSIRE(ruc);

    if (!shouldSyncBuzon && !shouldSyncSIRE) {
      // No hay nada que sincronizar
      const buzonElapsed = lastSync?.buzon ? Math.floor((Date.now() - lastSync.buzon) / (1000 * 60)) : 'never';
      const sireElapsed = lastSync?.sire ? Math.floor((Date.now() - lastSync.sire) / (1000 * 60)) : 'never';
      
      return { 
        skipped: true, 
        reason: 'throttle',
        details: {
          buzonLastSync: buzonElapsed,
          sireLastSync: sireElapsed,
          throttleMinutes: this.THROTTLE_MINUTES
        }
      };
    }

    // Usar checkAndSync normal para ejecutar
    return await this.checkAndSync(workspace, userId);
  }

  /**
   * Limpia el estado de sincronización para un RUC específico
   */
  clearSyncState(ruc) {
    this.syncInProgress.delete(ruc);
    this.lastSyncTime.delete(ruc);
  }

  /**
   * Resetea el throttling para un RUC específico (solo para debugging)
   */
  resetThrottling(ruc) {
    const current = this.lastSyncTime.get(ruc) || {};
    this.lastSyncTime.set(ruc, {
      ...current,
      buzon: 0,  // Resetear a epoch para forzar sync
      sire: 0
    });
    console.log(`[AUTO SYNC] Throttling reseteado para ${ruc}`);
  }

  /**
   * Obtiene el estado de sincronización para debugging
   */
  getSyncStatus(ruc) {
    const lastSync = this.lastSyncTime.get(ruc) || {};
    const now = Date.now();
    
    return {
      inProgress: this.syncInProgress.get(ruc) || {},
      lastSync,
      throttleMinutes: this.THROTTLE_MINUTES,
      elapsedSinceLastBuzon: lastSync.buzon ? Math.floor((now - lastSync.buzon) / (1000 * 60)) : 'never',
      elapsedSinceLastSIRE: lastSync.sire ? Math.floor((now - lastSync.sire) / (1000 * 60)) : 'never',
      canSyncBuzon: this.shouldSyncBuzon(ruc),
      canSyncSIRE: this.shouldSyncSIRE(ruc)
    };
  }
}

// Singleton
const autoSyncService = new AutoSyncService();

module.exports = autoSyncService;
