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
        procedencia: procedencia || (serie?.startsWith('E') ? '1' : '2')
      });

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
        procedencia: procedencia || (serie?.startsWith('E') ? '1' : '2'),
        codOpcion: '02'
      });

      res.json(result);
    } catch (error) {
      console.error('[CPE DIRECT ERROR DESCARGA XML]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/cpe-direct/descargar-pdf
   * Descarga el archivo PDF oficial de SUNAT (opción 01)
   */
  router.post('/descargar-pdf', async (req, res) => {
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
        procedencia: procedencia || (serie?.startsWith('E') ? '1' : '2'),
        codOpcion: '01'
      });

      res.json(result);
    } catch (error) {
      console.error('[CPE DIRECT ERROR DESCARGA PDF]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/cpe-direct/descargar-xml-masivo-zip
   * Empaqueta todos los XMLs de los comprobantes consultados en un archivo ZIP
   */
  router.post('/descargar-xml-masivo-zip', async (req, res) => {
    try {
      const { ruc, usuario, clave } = await resolveCredentials(req);
      const { listaComprobantes } = req.body;

      if (!ruc || !usuario || !clave) {
        return res.status(400).json({ success: false, error: 'Credenciales Clave SOL requeridas.' });
      }

      if (!Array.isArray(listaComprobantes) || listaComprobantes.length === 0) {
        return res.status(400).json({ success: false, error: 'No hay comprobantes para exportar en ZIP.' });
      }

      console.log(`[CPE API] 📦 Petición de descarga masiva XML ZIP para ${listaComprobantes.length} comprobantes (RUC: ${ruc})`);

      const zipBuffer = await sunatDirectCpeService.generarZipXmlLote({
        rucEmpresa: ruc,
        usuarioSol: usuario,
        claveSol: clave,
        listaComprobantes
      });

      const zipFilename = `COMPROBANTES_XML_${ruc}_${Date.now()}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error('[CPE DIRECT ERROR ZIP XML MASIVO]:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/cpe-direct/descargar-pdf-masivo-zip
   * Empaqueta todos los PDFs de los comprobantes consultados en un archivo ZIP
   */
  router.post('/descargar-pdf-masivo-zip', async (req, res) => {
    try {
      const { ruc, usuario, clave } = await resolveCredentials(req);
      const { listaComprobantes } = req.body;

      if (!ruc || !usuario || !clave) {
        return res.status(400).json({ success: false, error: 'Credenciales Clave SOL requeridas.' });
      }

      if (!Array.isArray(listaComprobantes) || listaComprobantes.length === 0) {
        return res.status(400).json({ success: false, error: 'No hay comprobantes para exportar en ZIP.' });
      }

      console.log(`[CPE API] 📦 Petición de descarga masiva PDF ZIP para ${listaComprobantes.length} comprobantes (RUC: ${ruc})`);

      const zipBuffer = await sunatDirectCpeService.generarZipPdfLote({
        rucEmpresa: ruc,
        usuarioSol: usuario,
        claveSol: clave,
        listaComprobantes
      });

      const zipFilename = `COMPROBANTES_PDF_${ruc}_${Date.now()}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error('[CPE DIRECT ERROR ZIP PDF MASIVO]:', error.message);
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
      const { listaComprobantes, origen_consulta = 'EXCEL', concurrencia = 2, delayMs = 180 } = req.body;

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

      res.json({
        success: true,
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
