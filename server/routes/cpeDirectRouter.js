const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sunatDirectCpeService = require('../services/sunatDirectCpeService');

function createCpeDirectRouter(db) {
  const router = express.Router();

  /**
   * Helper unificado para consultas SELECT multiconector (Postgres / SQLite)
   */
  const executeQueryAll = async (sql, params = []) => {
    try {
      if (typeof db.queryAll === 'function') return await db.queryAll(sql, params);
      if (typeof db.all === 'function') return await db.all(sql, params);
      if (db.pool && typeof db.pool.query === 'function') {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        const res = await db.pool.query(pgSql, params);
        return res.rows || [];
      }
      if (typeof db.prepare === 'function') {
        const sqliteSql = sql.replace(/\$\d+/g, '?');
        return db.prepare(sqliteSql).all(...params);
      }
    } catch (e) {
      console.error('[CPE DIRECT DB QUERY ERROR]:', e.message);
      throw e;
    }
    return [];
  };

  /**
   * Helper unificado para INSERT / UPDATE / DELETE multiconector (Postgres / SQLite)
   */
  const executeRun = async (sql, params = []) => {
    try {
      if (typeof db.run === 'function') return await db.run(sql, params);
      if (db.pool && typeof db.pool.query === 'function') {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        const res = await db.pool.query(pgSql, params);
        return { changes: res.rowCount };
      }
      if (typeof db.prepare === 'function') {
        const sqliteSql = sql.replace(/\$\d+/g, '?');
        return db.prepare(sqliteSql).run(...params);
      }
    } catch (e) {
      console.error('[CPE DIRECT DB RUN ERROR]:', e.message);
      throw e;
    }
    return { changes: 0 };
  };

  /**
   * Helper para obtener credenciales Clave SOL del workspace si no se envían
   */
  async function resolveCredentials(req) {
    let ruc = req.body.ruc || req.body.workspace_id || req.query.ruc;
    let usuario = req.body.usuario_sol || req.body.sol_user || req.body.usuario;
    let clave = req.body.clave_sol || req.body.sol_pass || req.body.clave;

    if (ruc && (!usuario || !clave)) {
      try {
        const ws = await db.getWorkspaceById(ruc);
        if (ws) {
          if (!usuario) usuario = ws.sol_user || ws.sol_usuario;
          if (!clave) clave = ws.sol_pass || ws.sol_clave;
        }
      } catch (e) {
        console.warn('[CPE DIRECT] No se pudo leer workspace de BD:', e.message);
      }
    }

    return { ruc, usuario, clave };
  }

  /**
   * POST /api/cpe-direct/consultar-individual
   * Consulta individual por API Directa HTTP de SUNAT
   */
  router.post('/consultar-individual', async (req, res) => {
    try {
      const { ruc, usuario, clave } = await resolveCredentials(req);
      const { rucEmisor, tipoCpe, serie, correlativo, procedencia } = req.body;

      if (!ruc || !usuario || !clave) {
        return res.status(400).json({
          success: false,
          error: 'Credenciales Clave SOL (RUC, Usuario y Clave) requeridas.'
        });
      }

      if (!rucEmisor || !serie || !correlativo) {
        return res.status(400).json({
          success: false,
          error: 'RUC Emisor, Serie y Número correlativo son obligatorios.'
        });
      }

      console.log(`[CPE API] 📥 Consulta Individual recibida: ${rucEmisor} ${tipoCpe || '01'} ${serie}-${correlativo} (RUC Solicitante: ${ruc})`);

      const result = await sunatDirectCpeService.consultarComprobante({
        rucEmpresa: ruc,
        usuarioSol: usuario,
        claveSol: clave,
        rucEmisor,
        tipoCpe: tipoCpe || '01',
        serie,
        correlativo,
        procedencia: procedencia || '2'
      });

      // Guardar en historial si fue exitoso
      if (result.success && result.encontrado && result.data) {
        try {
          const loteId = uuidv4();
          const d = result.data;
          const userId = req.user?.id || 'system';

          // Insertar lote unitario
          const insertLoteQuery = `
            INSERT INTO cpe_consultas_masivas 
            (id, workspace_id, user_id, origen_consulta, total_registros, total_aceptados, total_anulados, total_no_encontrados, total_errores, monto_total_gravado, monto_total_igv, monto_total_general, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `;
          const paramsLote = [
            loteId, ruc, userId, 'INDIVIDUAL', 1,
            d.estado === 'ACEPTADO' ? 1 : 0,
            d.estado === 'ANULADO' ? 1 : 0,
            0, 0,
            d.montoGravado || 0, d.montoIgv || 0, d.montoTotal || 0,
            'COMPLETADO'
          ];
          
          await executeRun(insertLoteQuery, paramsLote);

          // Insertar item
          const insertItemQuery = `
            INSERT INTO cpe_consultas_items 
            (id, lote_id, workspace_id, ruc_emisor, razon_social_emisor, cod_cpe, num_serie, num_cpe, fecha_emision, moneda, mto_op_gravado, mto_igv, mto_total, estado_cpe, detalles_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `;
          const paramsItem = [
            uuidv4(), loteId, ruc, d.rucEmisor, d.razonSocialEmisor,
            d.tipoCpe, d.serie, d.numero, d.fechaEmision, d.moneda,
            d.montoGravado, d.montoIgv, d.montoTotal, d.estado,
            JSON.stringify(d)
          ];
          await executeRun(insertItemQuery, paramsItem);
        } catch (dbErr) {
          console.warn('[CPE DIRECT] No se pudo persistir consulta unitaria en BD:', dbErr.message);
        }
      }

      res.json(result);
    } catch (error) {
      console.error('[CPE DIRECT ERROR INDIVIDUAL]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/cpe-direct/descargar-xml
   * Descarga el archivo XML original de SUNAT (opción 02)
   */
  router.post('/descargar-xml', async (req, res) => {
    try {
      const { ruc, usuario, clave } = await resolveCredentials(req);
      const { rucEmisor, tipoCpe, serie, correlativo, procedencia } = req.body;

      if (!ruc || !usuario || !clave) {
        return res.status(400).json({
          success: false,
          error: 'Credenciales Clave SOL (RUC, Usuario y Clave) requeridas.'
        });
      }

      if (!rucEmisor || !serie || !correlativo) {
        return res.status(400).json({
          success: false,
          error: 'RUC Emisor, Serie y Número correlativo son obligatorios.'
        });
      }

      const result = await sunatDirectCpeService.descargarXmlComprobante({
        rucEmpresa: ruc,
        usuarioSol: usuario,
        claveSol: clave,
        rucEmisor,
        tipoCpe: tipoCpe || '01',
        serie,
        correlativo,
        procedencia: procedencia || '2',
        codOpcion: '02'
      });

      res.json(result);
    } catch (error) {
      console.error('[CPE DIRECT ERROR DESCARGA XML]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/cpe-direct/consultar-masivo
   * Consulta por lote masivo con procesamiento paralelo
   */
  router.post('/consultar-masivo', async (req, res) => {
    try {
      const { ruc, usuario, clave } = await resolveCredentials(req);
      const { listaComprobantes, origen_consulta = 'EXCEL', concurrencia = 2, delayMs = 150 } = req.body;

      if (!ruc || !usuario || !clave) {
        return res.status(400).json({
          success: false,
          error: 'Credenciales Clave SOL (RUC, Usuario y Clave) requeridas.'
        });
      }

      if (!Array.isArray(listaComprobantes) || listaComprobantes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'La lista de comprobantes está vacía o no tiene formato válido.'
        });
      }

      console.log(`[CPE API] 📥 Petición de consulta masiva recibida: ${listaComprobantes.length} comprobantes para RUC ${ruc} (Origen: ${origen_consulta}, Concurrencia: ${concurrencia}x, Delay: ${delayMs}ms)`);

      const batchResult = await sunatDirectCpeService.consultarLoteMasivo({
        rucEmpresa: ruc,
        usuarioSol: usuario,
        claveSol: clave,
        listaComprobantes,
        concurrencia: Math.max(1, Math.min(concurrencia, 4)),
        delayMs: Math.max(0, Math.min(delayMs, 1000))
      });

      // Persistir Lote y Detalle en Base de Datos
      const loteId = uuidv4();
      const userId = req.user?.id || 'system';
      const stats = batchResult.stats;

      try {
        const insertLoteQuery = `
          INSERT INTO cpe_consultas_masivas 
          (id, workspace_id, user_id, origen_consulta, total_registros, total_aceptados, total_anulados, total_no_encontrados, total_errores, monto_total_gravado, monto_total_igv, monto_total_general, estado)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        const paramsLote = [
          loteId, ruc, userId, origen_consulta,
          stats.total, stats.aceptados, stats.anulados, stats.noEncontrados, stats.errores,
          stats.montoTotalGravado, stats.montoTotalIgv, stats.montoTotalGeneral,
          'COMPLETADO'
        ];
        await executeRun(insertLoteQuery, paramsLote);

        // Guardar cada item procesado
        for (const itemRes of batchResult.resultados) {
          if (itemRes && itemRes.resultado) {
            const d = itemRes.resultado;
            const insertItemQuery = `
              INSERT INTO cpe_consultas_items 
              (id, lote_id, workspace_id, ruc_emisor, razon_social_emisor, cod_cpe, num_serie, num_cpe, fecha_emision, moneda, mto_op_gravado, mto_igv, mto_total, estado_cpe, detalles_json)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            `;
            const paramsItem = [
              uuidv4(), loteId, ruc, d.rucEmisor, d.razonSocialEmisor,
              d.tipoCpe, d.serie, d.numero, d.fechaEmision, d.moneda,
              d.montoGravado, d.montoIgv, d.montoTotal, d.estado,
              JSON.stringify(d)
            ];
            await executeRun(insertItemQuery, paramsItem);
          }
        }
      } catch (dbErr) {
        console.warn('[CPE DIRECT] Error al persistir lote masivo en BD:', dbErr.message);
      }

      res.json({
        success: true,
        loteId,
        stats: batchResult.stats,
        resultados: batchResult.resultados
      });

    } catch (error) {
      console.error('[CPE DIRECT ERROR MASIVO]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/cpe-direct/guardar-en-compras
   * Incorpora comprobantes validados directamente al registro de Compras (purchases)
   */
  router.post('/guardar-en-compras', async (req, res) => {
    try {
      const { workspace_id, comprobantes } = req.body;
      const wsId = workspace_id || req.body.ruc;

      if (!wsId || !Array.isArray(comprobantes) || comprobantes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Workspace ID y lista de comprobantes requeridos.'
        });
      }

      const userId = req.user?.id || 'system';
      let insertados = 0;

      for (const cpe of comprobantes) {
        const id = uuidv4();
        const fecha = cpe.fechaEmision || new Date().toISOString().split('T')[0];
        // Formatear fecha a YYYY-MM-DD si viene en formato DD/MM/YYYY
        let fechaIso = fecha;
        if (fecha.includes('/')) {
          const parts = fecha.split('/');
          if (parts.length === 3) {
            fechaIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        const tipoDoc = cpe.tipoCpe || '01';
        const serie = (cpe.serie || '').toUpperCase();
        const numero = String(cpe.numero || '');
        const rucEmisor = cpe.rucEmisor || cpe.doc_num || '';
        const razonSocial = cpe.razonSocialEmisor || cpe.nombre || 'PROVEEDOR SUNAT';
        const bi = Number(cpe.montoGravado || 0);
        const igv = Number(cpe.montoIgv || 0);
        const total = Number(cpe.montoTotal || (bi + igv));
        const moneda = cpe.moneda === 'USD' ? 'DOLARES' : 'SOLES';
        const glosa = `Compra CPE ${tipoDoc}-${serie}-${numero} ${razonSocial}`;

        const insertQuery = `
          INSERT INTO purchases (
            id, workspace_id, fecha, fecVcto, tipo_doc, serie, numero, 
            doc_tipo, doc_num, nombre, bi, igv, total, moneda, 
            glosa, estado_sire, user_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          )
        `;

        try {
          await executeRun(insertQuery, [
            id, wsId, fechaIso, fechaIso, tipoDoc, serie, numero,
            '6', rucEmisor, razonSocial, bi, igv, total, moneda,
            glosa, 'SUNAT_DIRECT', userId
          ]);
          insertados++;
        } catch (insertErr) {
          console.warn(`[CPE DIRECT] No se pudo insertar compra ${serie}-${numero}:`, insertErr.message);
        }
      }

      res.json({
        success: true,
        insertados,
        mensaje: `Se incorporaron ${insertados} comprobante(s) exitosamente al registro de compras.`
      });

    } catch (error) {
      console.error('[CPE DIRECT ERROR GUARDAR EN COMPRAS]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/cpe-direct/historial
   * Obtiene el historial de consultas masivas de un workspace
   */
  router.get('/historial', async (req, res) => {
    try {
      const workspace_id = req.query.workspace_id || req.query.ruc;
      if (!workspace_id) {
        return res.status(400).json({ success: false, error: 'workspace_id requerido' });
      }

      const query = `
        SELECT * FROM cpe_consultas_masivas 
        WHERE workspace_id = $1 
        ORDER BY created_at DESC 
        LIMIT 50
      `;
      const lotes = await executeQueryAll(query, [workspace_id]);

      res.json({
        success: true,
        lotes: lotes || []
      });
    } catch (error) {
      console.error('[CPE DIRECT HISTORIAL ERROR]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/cpe-direct/historial/:loteId/items
   * Obtiene los items de un lote específico
   */
  router.get('/historial/:loteId/items', async (req, res) => {
    try {
      const { loteId } = req.params;
      const query = `
        SELECT * FROM cpe_consultas_items 
        WHERE lote_id = $1 
        ORDER BY created_at ASC
      `;
      const items = await executeQueryAll(query, [loteId]);

      const parsedItems = (items || []).map(it => {
        let detalles = {};
        try {
          if (it.detalles_json) detalles = JSON.parse(it.detalles_json);
        } catch (e) {}
        return {
          ...it,
          detalles
        };
      });

      res.json({
        success: true,
        items: parsedItems
      });
    } catch (error) {
      console.error('[CPE DIRECT LOTE ITEMS ERROR]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createCpeDirectRouter;
