import { toast } from 'react-hot-toast';


// --- Interfaces para el formato antiguo (localStorage) ---
interface OldWorkspace {
  currentCompany: any;
  purchases: any[];
  sales: any[];
  journal: any[];
  asientos: any[];
  entities: any[];
  maintenanceRecords: any[];
  costs: any[];
  honorarios: any[];
  plan: any[];
  hhttAdjustments?: any;
}

interface OldAppState {
  workspaces: Record<string, OldWorkspace>;
}

/**
 * Script de migración de localStorage a SQLite.
 * Se ejecuta una sola vez al detectar que hay datos antiguos pero la DB está vacía.
 */
export async function runMigration() {
  const electron = (window as any).electronAPI;
  if (!electron) return;

  // 1. Verificar si ya tenemos workspaces en la DB
  const dbWorkspaces = await electron.dbGetWorkspaces();
  
  // Si ya hay datos en la DB, asumimos que la migración ya ocurrió o no es necesaria
  if (dbWorkspaces && dbWorkspaces.length > 0) {
    console.log('[MIGRACION] Base de datos ya inicializada.');
    return;
  }

  // 2. Intentar leer del localStorage antiguo (usado por Zustand persist)
  const rawStorage = localStorage.getItem('pld-system-storage');
  if (!rawStorage) {
    console.log('[MIGRACION] No se encontró localStorage previo.');
    return;
  }

  try {
    const parsed = JSON.parse(rawStorage);
    const state = parsed.state as OldAppState;

    if (!state.workspaces || Object.keys(state.workspaces).length === 0) {
      console.log('[MIGRACION] LocalStorage vacío.');
      return;
    }


    console.log('[MIGRACION] Iniciando migración de datos a SQLite...');

    for (const ruc of Object.keys(state.workspaces)) {
      const ws = state.workspaces[ruc];
      console.log(`[MIGRACION] Migrando empresa: ${ws.currentCompany.name} (${ruc})`);

      // Guardar Workspace (Info empresa)
      await electron.dbSaveWorkspace({
        ...ws.currentCompany,
        sol_user: ws.currentCompany.sol_user || '',
        sol_pass: ws.currentCompany.sol_pass || ''
      });

      // Migrar Compras
      for (const p of ws.purchases) {
        // Usamos execute directo para simplicidad en la migración masiva
        await electron.dbExecute(`
          INSERT OR REPLACE INTO purchases 
          (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tipOper, tipOperCode, ctaGasto, ctaAbono, moneda, tc, bi, igv, noGravada, isc, total, glosa, detraccion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          p.id, ruc, p.registro, p.fecha, p.fecVcto, p.tipo_doc, p.serie, p.numero, 
          p.doc_tipo, p.doc_num, p.nombre, p.tipOper, p.tipOperCode, p.ctaGasto, 
          p.ctaAbono, p.moneda, p.tc, p.bi, p.igv, p.noGravada, p.isc, 
          p.total, p.glosa, p.detraccion
        ]);
      }

      // Migrar Ventas
      for (const v of ws.sales) {
        await electron.dbExecute(`
          INSERT OR REPLACE INTO sales 
          (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tipOper, tipOperCode, ctaCargo, ctaIngreso, moneda, tc, bi, igv, noGravada, isc, total, glosa, detraccion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          v.id, ruc, v.registro, v.fecha, v.fecVcto, v.tipo_doc, v.serie, v.numero, 
          v.doc_tipo, v.doc_num, v.nombre, v.tipOper, v.tipOperCode, v.ctaCargo, 
          v.ctaIngreso, v.moneda, v.tc, v.bi, v.igv, v.noGravada, v.isc, 
          v.total, v.glosa, v.detraccion
        ]);
      }

      // Migrar Diario
      for (const j of ws.journal) {
        await electron.dbExecute(`
          INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, medio_pago, nro_transaccion, razon_social)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [j.id, ruc, j.source, j.asiento, j.fecha, j.glosa, j.cta, j.desc, j.debe, j.haber, j.medio_pago || null, j.nro_transaccion || null, j.razon_social || null]);
      }

      // Migrar Plan Contable
      for (const a of ws.plan) {
        await electron.dbExecute(`
          INSERT OR REPLACE INTO plan (cta, workspace_id, description, type, reqCenCos, amarreDebe, amarreHaber)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [a.cta, ruc, a.description, a.type, a.reqCenCos ? 1 : 0, a.amarreDebe, a.amarreHaber]);
      }

      // Migrar Entidades
      for (const e of ws.entities) {
        await electron.dbExecute(`
          INSERT OR REPLACE INTO entities (id, workspace_id, tipo, ruc, descripcion)
          VALUES (?, ?, ?, ?, ?)
        `, [e.id, ruc, e.tipo, e.ruc, e.descripcion]);
      }

      // Migrar Asientos (Completo/Header)
      for (const as of ws.asientos) {
         await electron.dbExecute(`
           INSERT OR REPLACE INTO asientos (id, workspace_id, header_json, lines_json)
           VALUES (?, ?, ?, ?)
         `, [as.id, ruc, JSON.stringify(as.header), JSON.stringify(as.lines)]);
      }

      // Migrar Ajustes HHTT
      if (ws.hhttAdjustments) {
        for (const [cta, adj] of Object.entries(ws.hhttAdjustments)) {
          await electron.dbExecute(`
            INSERT OR REPLACE INTO hhtt_adjustments (workspace_id, cta, debe, haber)
            VALUES (?, ?, ?, ?)
          `, [ruc, cta, (adj as any).debe, (adj as any).haber]);
        }
      }

      // Otros (mantenimiento, costos, honorarios)
      for (const h of ws.honorarios) {
        await electron.dbExecute(`
          INSERT OR REPLACE INTO honorarios (id, workspace_id, registro, fecha, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, ctaGasto, ctaAbono, bi, retencion, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [h.id, ruc, h.registro, h.fecha, h.tipo_doc, h.serie, h.numero, h.doc_tipo, h.doc_num, h.nombre, h.ctaGasto, h.ctaAbono, h.bi, h.retencion, h.total]);
      }
      
      for (const m of ws.maintenanceRecords) {
        await electron.dbExecute(`
          INSERT OR REPLACE INTO maintenance (id, workspace_id, periodo, anexo, descripcion, monto)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [m.id, ruc, m.periodo, m.anexo, m.descripcion, m.monto]);
      }

      for (const c of ws.costs) {
        await electron.dbExecute(`
          INSERT OR REPLACE INTO costs (id, workspace_id, codigo, descripcion, porcentaje, monto, cuenta_debe, cuenta_haber)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [c.id, ruc, c.codigo, c.descripcion, c.porcentaje, c.monto, c.cuenta_debe || '94111', c.cuenta_haber || '79111']);
      }
    }

    console.log('[MIGRACION] ¡Migración completada con éxito!');
    toast.success("Se han migrado tus datos locales a SQLite con éxito.", { duration: 6000 });

  } catch (err) {
    console.error('[MIGRACION] Error crítico durante la migración:', err);
    toast.error("Ocurrió un error crítico durante la migración de datos.");
  }

}
