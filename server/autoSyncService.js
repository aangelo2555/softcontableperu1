/**
 * Servicio de Sincronización Automática
 * - Buzón Electrónico automático cuando se configuren credenciales SOL
 * - SIRE automático desde enero hasta mes actual cuando se configuren credenciales SIRE
 */

const buzonHandler = require('../main/buzonHandler');
const sireHandler = require('../modulo/sireHandler');
const db = require('./databaseServer');

class AutoSyncService {
  constructor() {
    this.syncInProgress = new Map(); // ruc -> { buzon: boolean, sire: boolean }
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
   * Ejecuta la sincronización automática del Buzón Electrónico
   * Solo para la empresa especificada
   */
  async autoSyncBuzon(workspace) {
    const ruc = workspace.ruc;

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
   * Se llama cuando se guarda o actualiza un workspace
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
   * Limpia el estado de sincronización para un RUC específico
   */
  clearSyncState(ruc) {
    this.syncInProgress.delete(ruc);
  }
}

// Singleton
const autoSyncService = new AutoSyncService();

module.exports = autoSyncService;
