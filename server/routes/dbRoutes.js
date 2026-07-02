const express = require('express');
const router = express.Router();
const dbController = require('../controllers/dbController');

/**
 * dbRoutes.js - Definición de rutas desacopladas para /api/db
 */

router.get('/workspaces', dbController.getWorkspaces);
router.post('/workspaces', dbController.saveWorkspace);

router.get('/workspace/:ruc', dbController.getWorkspaceData);
router.get('/workspaces/:ruc', dbController.getWorkspaceData);
router.delete('/workspace/:ruc', dbController.deleteWorkspace);
router.delete('/workspaces/:ruc', dbController.deleteWorkspace);

router.get('/purchases', dbController.getPurchases);
router.get('/sales', dbController.getSales);
router.get('/journal', dbController.getJournal);

module.exports = router;
